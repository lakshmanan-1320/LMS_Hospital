import { registerAs } from '@nestjs/config';

export const storageConfig = registerAs('storage', () => {
  const useAwsStorage = process.env.USE_AWS_STORAGE === 'true';

  const awsRegion = process.env.AWS_REGION || 'ap-south-1';
  const awsBucket = process.env.AWS_S3_BUCKET || '';
  const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID || '';
  const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || '';

  if (useAwsStorage) {
    const missing = [];

    if (!awsBucket) missing.push('AWS_S3_BUCKET');

    if (!awsAccessKeyId) missing.push('AWS_ACCESS_KEY_ID');

    if (!awsSecretAccessKey) missing.push('AWS_SECRET_ACCESS_KEY');

    if (missing.length) {
      throw new Error(
        `AWS storage is enabled, but configuration is missing: ${missing.join(', ')}`,
      );
    }
  }

  return {
    provider: useAwsStorage ? 's3' : 'local',
    localRoot:
      process.env.LOCAL_STORAGE_ROOT ||
      require('path').resolve(process.cwd(), 'private-storage'),

    aws: {
      region: awsRegion,
      bucket: awsBucket,
      accessKeyId: awsAccessKeyId,
      secretAccessKey: awsSecretAccessKey,
    },

    drm: {
      enabled: process.env.DRM_ENABLED === 'true',
      provider: process.env.DRM_PROVIDER || 'none',
    },
  };
});
