import { Injectable, Logger } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import * as QRCode from 'qrcode';

export interface CertificateRenderData {
  certificateNumber: string;
  certificateType: 'course_completion' | 'webinar_participation';
  studentName: string;
  subjectTitle: string; // Course name or Webinar name
  instructorName?: string;
  completionDate: Date | string;
  verificationUrl: string;
  templateConfig?: {
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    title?: string;
    subtitle?: string;
    statement?: string;
    footerText?: string;
    showQrCode?: boolean;
  };
}

@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name);

  async generateCertificatePdf(data: CertificateRenderData): Promise<Buffer> {
    const isWebinar = data.certificateType === 'webinar_participation';

    const primaryColor =
      data.templateConfig?.primaryColor || (isWebinar ? '#065F46' : '#1E3A8A');
    const secondaryColor =
      data.templateConfig?.secondaryColor || (isWebinar ? '#059669' : '#2563EB');
    const accentColor =
      data.templateConfig?.accentColor || (isWebinar ? '#D97706' : '#D97706');

    const defaultTitle = isWebinar
      ? 'CERTIFICATE OF PARTICIPATION'
      : 'CERTIFICATE OF COMPLETION';
    const defaultSubtitle = isWebinar
      ? 'THIS CERTIFICATE IS AWARDED TO'
      : 'THIS IS PROUDLY PRESENTED TO';
    const defaultStatement = isWebinar
      ? 'for active attendance and verified participation in the interactive webinar'
      : 'for successfully completing all required lessons and curriculum of the course';

    const titleText = (data.templateConfig?.title || defaultTitle).toUpperCase();
    const subtitleText = (data.templateConfig?.subtitle || defaultSubtitle).toUpperCase();
    const statementText = data.templateConfig?.statement || defaultStatement;
    const footerText =
      data.templateConfig?.footerText || 'Verified & Authorized by LMS Platform';

    // Format date: e.g. "November 18, 2026"
    const dateObj = new Date(data.completionDate);
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Generate QR code buffer
    let qrBuffer: Buffer | null = null;
    try {
      qrBuffer = await QRCode.toBuffer(data.verificationUrl, {
        width: 100,
        margin: 1,
        color: {
          dark: '#0F172A',
          light: '#FFFFFF',
        },
      });
    } catch (err) {
      this.logger.error('Failed to generate QR code for certificate', err);
    }

    return new Promise<Buffer>((resolve, reject) => {
      const PDFDocConstructor: any =
        (PDFDocument as any)?.default || PDFDocument;
      const doc: PDFKit.PDFDocument = new PDFDocConstructor({
        size: 'A4',
        layout: 'landscape',
        margins: { top: 30, bottom: 30, left: 30, right: 30 },
        info: {
          Title: `${titleText} - ${data.studentName}`,
          Author: 'LMS Platform',
          Subject: data.subjectTitle,
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const pageWidth = doc.page.width; // 841.89
      const pageHeight = doc.page.height; // 595.28

      // Background fill
      doc.rect(0, 0, pageWidth, pageHeight).fill('#F8FAFC');

      // Outer border
      doc
        .lineWidth(6)
        .strokeColor(primaryColor)
        .rect(20, 20, pageWidth - 40, pageHeight - 40)
        .stroke();

      // Inner decorative border
      doc
        .lineWidth(1.5)
        .strokeColor(accentColor)
        .rect(28, 28, pageWidth - 56, pageHeight - 56)
        .stroke();

      // Corner ornamental accents (L-shapes in corners)
      const cornerSize = 24;
      const cornerOffset = 34;

      doc.lineWidth(2).strokeColor(primaryColor);
      // Top-Left
      doc
        .moveTo(cornerOffset, cornerOffset + cornerSize)
        .lineTo(cornerOffset, cornerOffset)
        .lineTo(cornerOffset + cornerSize, cornerOffset)
        .stroke();
      // Top-Right
      doc
        .moveTo(pageWidth - cornerOffset - cornerSize, cornerOffset)
        .lineTo(pageWidth - cornerOffset, cornerOffset)
        .lineTo(pageWidth - cornerOffset, cornerOffset + cornerSize)
        .stroke();
      // Bottom-Left
      doc
        .moveTo(cornerOffset, pageHeight - cornerOffset - cornerSize)
        .lineTo(cornerOffset, pageHeight - cornerOffset)
        .lineTo(cornerOffset + cornerSize, pageHeight - cornerOffset)
        .stroke();
      // Bottom-Right
      doc
        .moveTo(pageWidth - cornerOffset - cornerSize, pageHeight - cornerOffset)
        .lineTo(pageWidth - cornerOffset, pageHeight - cornerOffset)
        .lineTo(pageWidth - cornerOffset, pageHeight - cornerOffset - cornerSize)
        .stroke();

      // Header organization text
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor(secondaryColor)
        .text('LEARNING MANAGEMENT SYSTEM ACADEMY', 50, 52, {
          align: 'center',
          characterSpacing: 2,
        });

      // Main Certificate Title
      doc
        .font('Helvetica-Bold')
        .fontSize(26)
        .fillColor(primaryColor)
        .text(titleText, 50, 80, {
          align: 'center',
          characterSpacing: 1.5,
        });

      // Decorative divider under title
      const dividerWidth = 140;
      const centerX = pageWidth / 2;
      doc
        .lineWidth(2)
        .strokeColor(accentColor)
        .moveTo(centerX - dividerWidth / 2, 118)
        .lineTo(centerX + dividerWidth / 2, 118)
        .stroke();

      // Subtitle
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#64748B')
        .text(subtitleText, 50, 134, {
          align: 'center',
          characterSpacing: 1.5,
        });

      // Student Name
      doc
        .font('Helvetica-Bold')
        .fontSize(28)
        .fillColor('#0F172A')
        .text(data.studentName, 50, 160, {
          align: 'center',
        });

      // Underline student name
      const nameWidth = Math.min(pageWidth - 200, Math.max(300, data.studentName.length * 15));
      doc
        .lineWidth(1)
        .strokeColor('#CBD5E1')
        .moveTo(centerX - nameWidth / 2, 196)
        .lineTo(centerX + nameWidth / 2, 196)
        .stroke();

      // Statement
      doc
        .font('Helvetica')
        .fontSize(12)
        .fillColor('#475569')
        .text(statementText, 80, 212, {
          align: 'center',
          width: pageWidth - 160,
        });

      // Subject Title (Course or Webinar)
      doc
        .font('Helvetica-Bold')
        .fontSize(20)
        .fillColor(primaryColor)
        .text(`"${data.subjectTitle}"`, 60, 248, {
          align: 'center',
          width: pageWidth - 120,
        });

      // Middle badge / Achievement stamp
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(accentColor)
        .text('★ VERIFIED ACADEMIC ACHIEVEMENT ★', 50, 310, {
          align: 'center',
          characterSpacing: 1.5,
        });

      // Bottom Section Layout (Y = 380 to 520)
      const bottomY = 400;

      // 1. Left Column: Date & Instructor
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#334155')
        .text('DATE OF ISSUANCE', 70, bottomY);

      doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor('#0F172A')
        .text(formattedDate, 70, bottomY + 16);

      if (data.instructorName) {
        doc
          .lineWidth(1)
          .strokeColor('#94A3B8')
          .moveTo(70, bottomY + 65)
          .lineTo(240, bottomY + 65)
          .stroke();

        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor('#0F172A')
          .text(data.instructorName, 70, bottomY + 70);

        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#64748B')
          .text('Course Instructor / Program Lead', 70, bottomY + 86);
      }

      // 2. Center Column: Security & Certification info
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(primaryColor)
        .text('OFFICIAL CERTIFICATION', centerX - 100, bottomY + 30, {
          width: 200,
          align: 'center',
        });

      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#64748B')
        .text(footerText, centerX - 120, bottomY + 48, {
          width: 240,
          align: 'center',
        });

      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#0F172A')
        .text(`Certificate ID: ${data.certificateNumber}`, centerX - 120, bottomY + 74, {
          width: 240,
          align: 'center',
        });

      // 3. Right Column: QR Code & Verification
      if (qrBuffer) {
        const qrSize = 85;
        const qrX = pageWidth - 70 - qrSize;
        const qrY = bottomY - 10;

        doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor('#0F172A')
          .text('SCAN TO VERIFY', qrX - 25, qrY + qrSize + 6, {
            width: qrSize + 50,
            align: 'center',
          });

        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor('#64748B')
          .text('Instant Online Verification', qrX - 25, qrY + qrSize + 18, {
            width: qrSize + 50,
            align: 'center',
          });
      }

      // Finalize PDF
      doc.end();
    });
  }
}
