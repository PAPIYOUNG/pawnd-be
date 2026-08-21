import PDFDocument from 'pdfkit';
import * as path from 'path';
import * as fs from 'fs';
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
  private static getFontPath(fontFilename: string): string | null {
    const candidates = [
      path.join(__dirname, '../../assets/fonts', fontFilename),
      path.join(process.cwd(), 'src/assets/fonts', fontFilename),
      path.join(process.cwd(), 'dist/src/assets/fonts', fontFilename),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  static async generate(
    data: FlyerPostData,
    template: FlyerTemplate = FlyerTemplate.WANTED,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
        info: {
          Title: `PAWND Wanted Poster - ${data.petName || data.type}`,
          Author: 'PAWND Network',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // Register Thai fonts
      const regularFontPath = this.getFontPath('Sarabun-Regular.ttf');
      const boldFontPath = this.getFontPath('Sarabun-Bold.ttf');

      const hasThaiFont = Boolean(regularFontPath && boldFontPath);
      if (hasThaiFont && regularFontPath && boldFontPath) {
        doc.registerFont('ThaiRegular', regularFontPath);
        doc.registerFont('ThaiBold', boldFontPath);
      }

      if (template === FlyerTemplate.STANDARD) {
        this.renderStandardTemplate(doc, data, hasThaiFont);
      } else {
        this.renderWantedTemplate(doc, data, hasThaiFont);
      }

      doc.end();
    });
  }

  /**
   * One Piece "WANTED" Bounty Poster Template (Thai Localization & Frameless Clean Design)
   */
  private static renderWantedTemplate(
    doc: PDFKit.PDFDocument,
    data: FlyerPostData,
    hasThaiFont: boolean,
  ) {
    const pageWidth = 595.28;
    const pageHeight = 841.89;

    const boldFont = hasThaiFont ? 'ThaiBold' : 'Helvetica-Bold';
    const regFont = hasThaiFont ? 'ThaiRegular' : 'Helvetica';

    // 1. Pale Warm Vintage Parchment Background
    doc.rect(0, 0, pageWidth, pageHeight).fill('#FCF8ED');
    doc.rect(15, 15, pageWidth - 30, pageHeight - 30).fill('#F8F1DE');

    // 2. Double Vintage Outer Border
    const borderDark = '#4A2E19';
    doc
      .rect(20, 20, pageWidth - 40, pageHeight - 40)
      .lineWidth(3.5)
      .stroke(borderDark);

    doc
      .rect(26, 26, pageWidth - 52, pageHeight - 52)
      .lineWidth(1.2)
      .stroke(borderDark);

    this.drawCornerAccents(doc, borderDark);

    // 2.1 Logo (Top-Left Corner - Extra Large & Transparent)
    const logoPath = this.getLogoPath();
    if (logoPath) {
      try {
        doc.image(logoPath, 30, 26, {
          fit: [95, 95],
        });
      } catch {
        // Safe fallback if logo fails
      }
    }

    // 3. Giant "WANTED" Header (Red Color)
    doc
      .fillColor('#C5221F')
      .fontSize(72)
      .font('Times-Bold')
      .text('WANTED', 0, 36, { align: 'center', width: pageWidth });

    // 4. Main Pet Photo (Clean Frameless Display)
    const photoBoxWidth = 460;
    const photoBoxHeight = 265;
    const photoBoxX = (pageWidth - photoBoxWidth) / 2;
    const photoBoxY = 112;

    if (data.petImageBuffer) {
      try {
        doc.image(data.petImageBuffer, photoBoxX, photoBoxY, {
          fit: [photoBoxWidth, photoBoxHeight],
          align: 'center',
          valign: 'center',
        });
      } catch {
        this.drawPhotoPlaceholder(
          doc,
          photoBoxX,
          photoBoxY,
          photoBoxWidth,
          photoBoxHeight,
          boldFont,
        );
      }
    } else {
      this.drawPhotoPlaceholder(
        doc,
        photoBoxX,
        photoBoxY,
        photoBoxWidth,
        photoBoxHeight,
        boldFont,
      );
    }

    let currentY = photoBoxY + photoBoxHeight + 18;

    // 5. Sub-header (Thai): "โปรดช่วยตามหาน้อง" / "พบสัตว์เลี้ยง (ตามหาเจ้าของ)"
    const isLost = data.type === 'LOST';
    const subTitle = isLost
      ? 'โปรดช่วยตามหาน้อง'
      : 'พบสัตว์เลี้ยง (ตามหาเจ้าของ)';

    doc
      .fillColor('#4A2E19')
      .fontSize(22)
      .font(boldFont)
      .text(subTitle, 0, currentY, { align: 'center', width: pageWidth });

    currentY += 34;

    // 6. Pet Name
    const petName = (
      data.petName ||
      data.breed ||
      data.petType ||
      'ไม่ระบุชื่อ'
    ).toUpperCase();
    doc
      .fillColor('#2A1608')
      .fontSize(38)
      .font(boldFont)
      .text(petName, 0, currentY, { align: 'center', width: pageWidth });

    currentY += 46;

    // 7. Bounty / Reward Section (Thai)
    const rewardVal = data.rewardAmount
      ? Number(data.rewardAmount).toLocaleString()
      : null;

    if (rewardVal) {
      doc
        .fillColor('#C5221F')
        .fontSize(28)
        .font(boldFont)
        .text(`รางวัลนำส่ง: ${rewardVal} บาท`, 0, currentY, {
          align: 'center',
          width: pageWidth,
        });
    } else {
      doc
        .fillColor('#5C3D25')
        .fontSize(20)
        .font(boldFont)
        .text('มีรางวัลตอบแทนสำหรับผู้พบเห็น', 0, currentY + 3, {
          align: 'center',
          width: pageWidth,
        });
    }

    currentY += 56;

    // 8. Details & QR Code (Frameless clean layout with wider line spacing)
    const detailsX = 48;
    const detailsWidth = 350;
    const qrX = 415;
    const qrSize = 130;

    let dY = currentY;
    doc.fillColor('#2A1608').fontSize(16).font(boldFont);
    doc.text('ข้อมูลสัตว์เลี้ยง:', detailsX, dY);
    dY += 27;

    doc.fontSize(13).font(regFont);

    // Translate Pet Type & Gender
    const petTypeThai = this.translatePetType(data.petType);
    const genderThai = this.translateGender(data.gender);

    const typeLine = `ชนิด / สายพันธุ์: ${petTypeThai} ${data.breed ? `(${data.breed})` : ''}`;
    doc.text(typeLine, detailsX, dY, { width: detailsWidth });
    dY += 25;

    const genderLine = `เพศ: ${genderThai}   |   สี: ${data.color || 'ไม่ระบุ'}`;
    doc.text(genderLine, detailsX, dY, { width: detailsWidth });
    dY += 25;

    const formattedDate = new Date(data.eventDate).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    doc.text(`วันที่${isLost ? 'หาย' : 'พบ'}: ${formattedDate}`, detailsX, dY, {
      width: detailsWidth,
    });
    dY += 25;

    const locationParts = [
      data.subdistrict,
      data.district,
      data.province,
    ].filter(Boolean);
    if (locationParts.length > 0) {
      doc.text(`สถานที่ล่าสุด: ${locationParts.join(', ')}`, detailsX, dY, {
        width: detailsWidth,
      });
      dY += 25;
    }

    if (data.distinctiveFeatures) {
      doc
        .font(boldFont)
        .text('จุดเด่น / ตำหนิ: ', detailsX, dY, { continued: true });
      doc.font(regFont).text(data.distinctiveFeatures, { width: detailsWidth });
    }

    // 9. QR Code (Frameless on right side)
    if (data.qrImageBuffer) {
      try {
        doc.image(data.qrImageBuffer, qrX, currentY + 4, {
          width: 125,
          height: 125,
        });
        doc
          .fillColor('#4A2E19')
          .fontSize(11)
          .font(boldFont)
          .text('สแกนแจ้งเบาะแส', qrX - 10, currentY + 134, {
            align: 'center',
            width: 145,
          });
      } catch {
        // QR fallback
      }
    }

    // 10. Large Prominent Contact Line (Frameless & Bold Red with ติดต่อ prefix)
    const contactBoxY = currentY + 168;
    const phone = data.contactPhone ? `ติดต่อ โทร: ${data.contactPhone}` : '';
    const line = data.contactLineId ? `LINE: ${data.contactLineId}` : '';
    const contactInfo =
      [phone, line].filter(Boolean).join('     |     ') ||
      'กรุณาติดต่อเจ้าของผ่านแอป PAWND';

    doc
      .fillColor('#C5221F')
      .fontSize(20)
      .font(boldFont)
      .text(contactInfo, 0, contactBoxY, {
        align: 'center',
        width: pageWidth,
      });

    // 11. Bottom Brand Signature
    doc
      .fillColor('#4A2E19')
      .fontSize(15)
      .font('Times-Bold')
      .text('P A W N D', pageWidth - 160, pageHeight - 46, {
        align: 'right',
        width: 120,
      });

    doc
      .fillColor('#8A6E55')
      .fontSize(9)
      .font(regFont)
      .text(
        'PAWND แพลตฟอร์มช่วยตามหาสัตว์เลี้ยง  •  PAWND.APP',
        45,
        pageHeight - 42,
      );
  }

  /**
   * Standard Modern Template
   */
  private static renderStandardTemplate(
    doc: PDFKit.PDFDocument,
    data: FlyerPostData,
    hasThaiFont: boolean,
  ) {
    const boldFont = hasThaiFont ? 'ThaiBold' : 'Helvetica-Bold';
    const regFont = hasThaiFont ? 'ThaiRegular' : 'Helvetica';

    const isLost = data.type === 'LOST';
    const mainColor = isLost ? '#DC2626' : '#2563EB';
    const titleText = isLost
      ? 'สัตว์เลี้ยงหาย (MISSING PET)'
      : 'พบสัตว์เลี้ยง (FOUND PET)';

    doc.rect(40, 40, 515, 60).fill(mainColor);
    doc
      .fillColor('#FFFFFF')
      .fontSize(28)
      .font(boldFont)
      .text(titleText, 40, 55, { align: 'center', width: 515 });

    let currentY = 115;

    if (data.rewardAmount) {
      doc.rect(40, currentY, 515, 45).fill('#FBBF24');
      doc
        .fillColor('#78350F')
        .fontSize(22)
        .font(boldFont)
        .text(
          `รางวัลนำส่ง: ${Number(data.rewardAmount).toLocaleString()} บาท`,
          40,
          currentY + 12,
          {
            align: 'center',
            width: 515,
          },
        );
      currentY += 55;
    }

    if (data.petName) {
      doc
        .fillColor('#1F2937')
        .fontSize(26)
        .font(boldFont)
        .text(data.petName, 40, currentY, { align: 'center', width: 515 });
      currentY += 35;
    }

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
        this.drawPhotoPlaceholder(
          doc,
          imageBoxX,
          currentY,
          imageBoxWidth,
          imageBoxHeight,
          boldFont,
        );
      }
    } else {
      this.drawPhotoPlaceholder(
        doc,
        imageBoxX,
        currentY,
        imageBoxWidth,
        imageBoxHeight,
        boldFont,
      );
    }
    currentY += imageBoxHeight + 15;

    const detailsX = 55;
    let detailY = currentY + 12;

    doc.fillColor('#111827').fontSize(14).font(boldFont);
    doc.text('ข้อมูลสัตว์เลี้ยง:', detailsX, detailY);
    detailY += 20;

    doc.fontSize(12).font(regFont);
    const petTypeThai = this.translatePetType(data.petType);
    const genderThai = this.translateGender(data.gender);

    doc.text(
      `ชนิด / สายพันธุ์: ${petTypeThai} ${data.breed ? `(${data.breed})` : ''}`,
      detailsX,
      detailY,
    );
    detailY += 18;

    doc.text(
      `เพศ: ${genderThai} | สี: ${data.color || 'ไม่ระบุ'}`,
      detailsX,
      detailY,
    );
    detailY += 18;

    const formattedDate = new Date(data.eventDate).toLocaleDateString('th-TH');
    doc.text(
      `วันที่${isLost ? 'หาย' : 'พบ'}: ${formattedDate}`,
      detailsX,
      detailY,
    );
    detailY += 18;

    const locationParts = [
      data.subdistrict,
      data.district,
      data.province,
    ].filter(Boolean);
    if (locationParts.length > 0) {
      doc.text(`สถานที่: ${locationParts.join(', ')}`, detailsX, detailY);
      detailY += 18;
    }
    if (data.distinctiveFeatures) {
      doc
        .font(boldFont)
        .text('จุดเด่น / ตำหนิ: ', detailsX, detailY, { continued: true });
      doc.font(regFont).text(data.distinctiveFeatures);
    }

    const qrBoxX = 405;
    const qrBoxY = currentY;

    if (data.qrImageBuffer) {
      try {
        doc.image(data.qrImageBuffer, qrBoxX, qrBoxY, {
          width: 125,
          height: 125,
        });
        doc
          .fillColor('#4B5563')
          .fontSize(10)
          .font(boldFont)
          .text('สแกนดูรายละเอียด', qrBoxX - 10, qrBoxY + 130, {
            align: 'center',
            width: 145,
          });
      } catch {
        // Ignore QR error
      }
    }

    currentY += 175;

    doc.rect(40, currentY, 515, 65).fill(mainColor);
    doc
      .fillColor('#FFFFFF')
      .fontSize(14)
      .font(boldFont)
      .text('หากพบเห็นหรือมีเบาะแส กรุณาติดต่อ:', 40, currentY + 10, {
        align: 'center',
        width: 515,
      });

    const phone = data.contactPhone ? `โทร: ${data.contactPhone}` : '';
    const line = data.contactLineId ? `LINE: ${data.contactLineId}` : '';
    const contactSummary = [phone, line].filter(Boolean).join('   |   ');

    doc
      .fillColor('#FFFFFF')
      .fontSize(15)
      .font(boldFont)
      .text(
        contactSummary || 'สแกน QR Code ด้านบนเพื่อติดต่อเจ้าของผ่าน PAWND',
        40,
        currentY + 34,
        {
          align: 'center',
          width: 515,
        },
      );
  }

  private static drawCornerAccents(doc: PDFKit.PDFDocument, color: string) {
    const size = 12;
    // Top-Left
    doc.rect(20, 20, size, size).fill(color);
    // Top-Right
    doc.rect(595.28 - 20 - size, 20, size, size).fill(color);
    // Bottom-Left
    doc.rect(20, 841.89 - 20 - size, size, size).fill(color);
    // Bottom-Right
    doc.rect(595.28 - 20 - size, 841.89 - 20 - size, size, size).fill(color);
  }

  private static drawPhotoPlaceholder(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    height: number,
    fontName: string,
  ) {
    doc.rect(x, y, width, height).fillAndStroke('#EDE0C7', '#B8A17A');
    doc
      .fillColor('#6B4E34')
      .fontSize(18)
      .font(fontName)
      .text('รูปถ่ายสัตว์เลี้ยง', x, y + height / 2 - 10, {
        align: 'center',
        width: width,
      });
  }

  private static translatePetType(type?: string | null): string {
    if (!type) return 'ไม่ระบุ';
    const map: Record<string, string> = {
      DOG: 'สุนัข (Dog)',
      CAT: 'แมว (Cat)',
      BIRD: 'นก (Bird)',
      RABBIT: 'กระต่าย (Rabbit)',
      OTHER: 'สัตว์เลี้ยงอื่นๆ',
    };
    return map[type.toUpperCase()] || type;
  }

  private static translateGender(gender?: string | null): string {
    if (!gender) return 'ไม่ระบุ';
    const map: Record<string, string> = {
      MALE: 'ผู้ (Male)',
      FEMALE: 'เมีย (Female)',
      UNKNOWN: 'ไม่ระบุ',
    };
    return map[gender.toUpperCase()] || gender;
  }

  private static getLogoPath(): string | null {
    const candidates = [
      path.join(process.cwd(), 'src', 'assets', 'images', 'pawnd-logo.png'),
      path.join(process.cwd(), 'dist', 'assets', 'images', 'pawnd-logo.png'),
      path.join(__dirname, '..', '..', 'assets', 'images', 'pawnd-logo.png'),
      path.join(__dirname, '..', 'assets', 'images', 'pawnd-logo.png'),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
    return null;
  }
}
