import PDFDocument from 'pdfkit';
import { FlyerTemplate } from '../dto/generate-flyer.dto';

export interface FlyerPostData {
  id: string;
  type: string;
  petName?: string | null;
  petType?: string | null;
  breed?: string | null;
  gender?: string | null;
  color?: string | null;
  distinctiveFeatures?: string | null;
  description?: string | null;
  eventDate: Date;
  province?: string | null;
  district?: string | null;
  subdistrict?: string | null;
  locationDescription?: string | null;
  rewardAmount?: number | string | null;
  contactPhone?: string | null;
  contactLineId?: string | null;
  contactEmail?: string | null;
  userName?: string | null;
  userPhone?: string | null;
  petImageUrl?: string | null;
  petImageBuffer?: Buffer | null;
  qrImageBuffer?: Buffer | null;
}

export class FlyerPdfGenerator {
  static async generate(
    data: FlyerPostData,
    template: FlyerTemplate = FlyerTemplate.STANDARD,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `PAWND Flyer - ${data.petName || data.type}`,
          Author: 'PAWND Network',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const isLost = data.type === 'LOST';
      const mainColor = isLost ? '#DC2626' : '#2563EB'; // Red for Lost, Blue for Found
      const titleText = isLost ? 'MISSING PET' : 'FOUND PET';

      // 1. Header Banner
      doc.rect(40, 40, 515, 60).fill(mainColor);
      doc
        .fillColor('#FFFFFF')
        .fontSize(32)
        .font('Helvetica-Bold')
        .text(titleText, 40, 55, { align: 'center', width: 515 });

      let currentY = 110;

      // 2. Reward Banner (if template is REWARD_EMPHASIS or reward exists)
      if (template === FlyerTemplate.REWARD_EMPHASIS && data.rewardAmount) {
        doc.rect(40, currentY, 515, 45).fill('#FBBF24'); // Yellow/Gold banner
        doc
          .fillColor('#78350F')
          .fontSize(22)
          .font('Helvetica-Bold')
          .text(`REWARD: ฿${data.rewardAmount}`, 40, currentY + 12, {
            align: 'center',
            width: 515,
          });
        currentY += 55;
      } else if (data.rewardAmount) {
        doc.rect(40, currentY, 515, 30).fill('#FEF3C7');
        doc
          .fillColor('#92400E')
          .fontSize(16)
          .font('Helvetica-Bold')
          .text(`REWARD: ฿${data.rewardAmount}`, 40, currentY + 7, {
            align: 'center',
            width: 515,
          });
        currentY += 40;
      }

      // 3. Pet Name
      if (data.petName) {
        doc
          .fillColor('#1F2937')
          .fontSize(26)
          .font('Helvetica-Bold')
          .text(data.petName, 40, currentY, { align: 'center', width: 515 });
        currentY += 35;
      }

      // 4. Pet Image (if buffer provided) or Placeholder Box
      const imageBoxWidth = 320;
      const imageBoxHeight = 220;
      const imageBoxX = (595 - imageBoxWidth) / 2;

      if (data.petImageBuffer) {
        try {
          doc.image(data.petImageBuffer, imageBoxX, currentY, {
            fit: [imageBoxWidth, imageBoxHeight],
            align: 'center',
            valign: 'center',
          });
        } catch {
          this.drawPlaceholderBox(doc, imageBoxX, currentY, imageBoxWidth, imageBoxHeight);
        }
      } else {
        this.drawPlaceholderBox(doc, imageBoxX, currentY, imageBoxWidth, imageBoxHeight);
      }
      currentY += imageBoxHeight + 15;

      // 5. Pet Details Section
      doc.rect(40, currentY, 340, 160).fillAndStroke('#F9FAFB', '#E5E7EB');

      const detailsX = 55;
      let detailY = currentY + 12;

      doc.fillColor('#111827').fontSize(12).font('Helvetica-Bold');
      doc.text('Key Details:', detailsX, detailY);
      detailY += 18;

      doc.fontSize(11).font('Helvetica');
      if (data.petType) {
        doc.text(`Type: ${data.petType} ${data.breed ? `(${data.breed})` : ''}`, detailsX, detailY);
        detailY += 16;
      }
      if (data.gender || data.color) {
        doc.text(
          `Gender: ${data.gender || 'Unknown'} | Color: ${data.color || 'N/A'}`,
          detailsX,
          detailY,
        );
        detailY += 16;
      }
      const formattedDate = new Date(data.eventDate).toLocaleDateString('en-GB');
      doc.text(`Date ${isLost ? 'Lost' : 'Found'}: ${formattedDate}`, detailsX, detailY);
      detailY += 16;

      const locationParts = [data.subdistrict, data.district, data.province].filter(Boolean);
      if (locationParts.length > 0) {
        doc.text(`Location: ${locationParts.join(', ')}`, detailsX, detailY);
        detailY += 16;
      }
      if (data.distinctiveFeatures) {
        doc.font('Helvetica-Bold').text(`Features: `, detailsX, detailY, { continued: true });
        doc.font('Helvetica').text(data.distinctiveFeatures);
      }

      // 6. QR Code Section (Right Side)
      const qrBoxX = 395;
      const qrBoxY = currentY;
      doc.rect(qrBoxX, qrBoxY, 160, 160).fillAndStroke('#FFFFFF', '#E5E7EB');

      if (data.qrImageBuffer) {
        try {
          doc.image(data.qrImageBuffer, qrBoxX + 15, qrBoxY + 10, {
            width: 130,
            height: 130,
          });
          doc
            .fillColor('#4B5563')
            .fontSize(8)
            .font('Helvetica-Bold')
            .text('SCAN FOR DETAILS', qrBoxX, qrBoxY + 143, {
              align: 'center',
              width: 160,
            });
        } catch {
          // Ignore image draw error
        }
      }

      currentY += 175;

      // 7. Contact Info Footer Banner
      doc.rect(40, currentY, 515, 65).fill(mainColor);

      doc
        .fillColor('#FFFFFF')
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('IF YOU HAVE ANY INFORMATION, PLEASE CONTACT:', 40, currentY + 10, {
          align: 'center',
          width: 515,
        });

      const phone = data.contactPhone || data.userPhone || 'N/A';
      const line = data.contactLineId ? `Line: ${data.contactLineId}` : '';
      const email = data.contactEmail ? `Email: ${data.contactEmail}` : '';
      const contactSummary = [phone !== 'N/A' ? `Phone: ${phone}` : '', line, email]
        .filter(Boolean)
        .join(' | ');

      doc
        .fillColor('#FFFFFF')
        .fontSize(13)
        .font('Helvetica-Bold')
        .text(contactSummary || 'Scan QR Code above to contact owner', 40, currentY + 34, {
          align: 'center',
          width: 515,
        });

      // 8. Bottom Brand Tag
      doc
        .fillColor('#9CA3AF')
        .fontSize(9)
        .font('Helvetica')
        .text('Generated by PAWND - Lost & Found Pet Network (pawnd.app)', 40, 800, {
          align: 'center',
          width: 515,
        });

      doc.end();
    });
  }

  private static drawPlaceholderBox(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    doc.rect(x, y, width, height).fillAndStroke('#F3F4F6', '#D1D5DB');
    doc
      .fillColor('#9CA3AF')
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('PHOTO OF PET', x, y + height / 2 - 10, {
        align: 'center',
        width: width,
      });
  }
}
