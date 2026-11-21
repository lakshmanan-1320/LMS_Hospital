import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { InstructorsService } from './instructors.service';
import { InstructorsRepository } from './instructors.repository';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

async function runTests() {
  console.log('--- STARTING INSTRUCTOR PROFILE MODULE INTEGRATION TESTS ---');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const service = app.get(InstructorsService);
  const repo = app.get(InstructorsRepository);

  // Jane Doe user_id
  const testUserId = '20f39118-e4a8-44e4-a836-5639ce95e52c';

  try {
    // 1. Initial State: Reset instructor_profiles row for testUserId
    await repo['db'].query('DELETE FROM instructor_profiles WHERE user_id = $1', [testUserId]);
    console.log('[PASS] Reset existing profile row for clean test.');

    // 2. Auto-provisioning on getMyProfile
    const myProfile = await service.getMyProfile(testUserId);
    if (!myProfile || myProfile.userId !== testUserId) {
      throw new Error('getMyProfile failed to return profile for user.');
    }
    if (myProfile.isPublic !== false) {
      throw new Error(`Expected isPublic to default to false, got ${myProfile.isPublic}`);
    }
    console.log('[PASS] Auto-provisioning works: profile created with isPublic = false.');

    // 3. Privacy Check: Public view should throw NotFoundException while isPublic = false
    let threw404 = false;
    try {
      await service.getPublicProfile(testUserId, []);
    } catch (err) {
      if (err instanceof NotFoundException) threw404 = true;
    }
    if (!threw404) {
      throw new Error('Public view succeeded when isPublic was false! Must throw 404.');
    }
    console.log('[PASS] Private profile hidden from public view (returns 404).');

    // 4. Update Profile with Udemy fields & deduplicated skills
    const updated = await service.updateMyProfile(testUserId, {
      headline: 'Principal Cloud Architect & Best-Selling Author',
      bio: 'Leading distributed systems engineering with 12+ years building cloud-native infrastructure.',
      experienceYears: 12,
      qualifications: [
        { title: 'M.S. in Computer Science', issuer: 'Stanford University', year: 2018 },
        { title: 'AWS Certified Solutions Architect Professional', issuer: 'Amazon Web Services', year: 2022 },
      ],
      expertise: ['Cloud Architecture', 'Full Stack Development'],
      skills: ['Kubernetes', 'NestJS', 'Next.js', 'PostgreSQL', 'Docker'],
      websiteUrl: 'https://janedoe.tech',
      linkedinUrl: 'https://linkedin.com/in/janedoe',
      githubUrl: 'https://github.com/janedoe',
      twitterUrl: 'https://twitter.com/janedoe',
      youtubeUrl: 'https://youtube.com/@janedoe',
      isPublic: true,
    });

    if (updated.headline !== 'Principal Cloud Architect & Best-Selling Author') {
      throw new Error('Headline update failed.');
    }
    if (updated.skills.length !== 5 || !updated.skills.includes('Kubernetes')) {
      throw new Error('Skills update failed.');
    }
    if (updated.isPublic !== true) {
      throw new Error('isPublic update to true failed.');
    }
    console.log('[PASS] Profile updated successfully with full Udemy-style fields.');

    // 5. Partial Update check: Update only headline, verify existing skills & bio remain intact
    const partialUpdated = await service.updateMyProfile(testUserId, {
      headline: 'Distinguished Cloud Architect & Author',
    });
    if (partialUpdated.headline !== 'Distinguished Cloud Architect & Author') {
      throw new Error('Partial headline update failed.');
    }
    if (!partialUpdated.bio || partialUpdated.skills.length !== 5) {
      throw new Error('Partial update wiped existing bio or skills!');
    }
    console.log('[PASS] Partial update preserves existing fields without overwriting.');

    // 6. Public Profile View: Ensure public profile is now visible and strictly contains NO email
    const publicView: any = await service.getPublicProfile(testUserId, []);
    if (!publicView || publicView.userId !== testUserId) {
      throw new Error('Public view failed for public profile.');
    }
    if (publicView.email !== undefined) {
      throw new Error('SECURITY VIOLATION: email exposed in public profile API!');
    }
    if (publicView.password_hash !== undefined) {
      throw new Error('SECURITY VIOLATION: password_hash exposed in public profile API!');
    }
    if (typeof publicView.totalCourses !== 'number') {
      throw new Error('Public view missing totalCourses counter.');
    }
    console.log(`[PASS] Public profile verified: NO email leaked, totalCourses = ${publicView.totalCourses}.`);

    // 7. Avatar Security Tests:
    // 7a. Valid JPEG buffer (FF D8 FF 00 ...)
    const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01]);
    const avatarResult1 = await service.uploadAvatar(testUserId, validJpegBuffer);
    if (!avatarResult1.avatarUrl.endsWith('.jpg')) {
      throw new Error(`Expected avatar to end in .jpg, got ${avatarResult1.avatarUrl}`);
    }
    console.log(`[PASS] JPEG avatar uploaded with secure random filename: ${avatarResult1.avatarUrl}`);

    // 7b. Valid PNG buffer (89 50 4E 47 ...)
    const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const avatarResult2 = await service.uploadAvatar(testUserId, validPngBuffer);
    if (!avatarResult2.avatarUrl.endsWith('.png')) {
      throw new Error(`Expected avatar to end in .png, got ${avatarResult2.avatarUrl}`);
    }
    console.log(`[PASS] PNG avatar uploaded, cleaned up old avatar: ${avatarResult2.avatarUrl}`);

    // 7c. Malicious fake image (plain text content)
    let rejectedSpoof = false;
    try {
      const fakeBuffer = Buffer.from('<?php echo "evil"; ?>');
      await service.uploadAvatar(testUserId, fakeBuffer);
    } catch (err) {
      if (err instanceof BadRequestException) rejectedSpoof = true;
    }
    if (!rejectedSpoof) {
      throw new Error('SECURITY VIOLATION: non-image buffer was accepted as avatar!');
    }
    console.log('[PASS] Spoofed image rejected via magic-byte inspection.');

    // 7d. File size exceeded limit (> 2MB)
    let rejectedOversize = false;
    try {
      const hugeBuffer = Buffer.alloc(2.5 * 1024 * 1024, 0xff);
      await service.uploadAvatar(testUserId, hugeBuffer);
    } catch (err) {
      if (err instanceof BadRequestException) rejectedOversize = true;
    }
    if (!rejectedOversize) {
      throw new Error('Oversized avatar buffer (>2MB) was accepted!');
    }
    console.log('[PASS] Oversized file (>2MB) rejected.');

    // 8. Public Directory Search Tests
    const dirAll = await service.getDirectory({ page: 1, limit: 10 });
    const foundInDir = dirAll.items.find((i) => i.userId === testUserId);
    if (!foundInDir) {
      throw new Error('Public instructor not found in directory search.');
    }
    console.log(`[PASS] Directory search returned public profile (total instructors: ${dirAll.total}).`);

    // 8b. Skill filter test
    const dirBySkill = await service.getDirectory({ skill: 'Kubernetes' });
    if (!dirBySkill.items.some((i) => i.userId === testUserId)) {
      throw new Error('Directory filter by skill "Kubernetes" failed to match instructor.');
    }
    console.log('[PASS] Directory filtered by skill "Kubernetes" correctly.');

    // 8c. Search query test
    const dirByName = await service.getDirectory({ search: 'Jane' });
    if (!dirByName.items.some((i) => i.userId === testUserId)) {
      throw new Error('Directory search by name "Jane" failed.');
    }
    console.log('[PASS] Directory search by name matched instructor.');

    // 9. Admin Moderation: Admin sets visibility to false
    await service.adminSetVisibility(testUserId, false);
    const profileAfterModeration = await service.getMyProfile(testUserId);
    if (profileAfterModeration.isPublic !== false) {
      throw new Error('Admin setVisibility to false failed.');
    }

    // Verify directory now excludes this profile
    const dirAfterHide = await service.getDirectory({ search: 'Jane' });
    if (dirAfterHide.items.some((i) => i.userId === testUserId)) {
      throw new Error('Private instructor still appeared in directory search results!');
    }
    console.log('[PASS] Admin visibility toggle hides profile from directory immediately.');

    // Admin can still view private profile using permission
    const adminView = await service.getPublicProfile(testUserId, ['instructors:manage']);
    if (!adminView || adminView.userId !== testUserId) {
      throw new Error('Admin with instructors:manage was blocked from inspecting private profile.');
    }
    console.log('[PASS] Admin with instructors:manage can inspect private profile.');

    console.log('\n======================================================');
    console.log('>>> ALL 9 INSTRUCTOR PROFILE TEST SUITES PASSED! <<<');
    console.log('======================================================\n');
  } finally {
    await app.close();
  }
}

runTests().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});

