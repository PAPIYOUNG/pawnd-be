import PDFDocument from 'pdfkit';
import * as path from 'path';
import * as fs from 'fs';

export interface PetProfilePdfData {
  id: string;
  name: string;
  type: string;
  breed?: string | null;
  gender?: string | null;
  color?: string | null;
  age?: number | null;
  distinctiveFeatures?: string | null;
  description?: string | null;
  profileImageBuffer?: Buffer | null;
  otherImageBuffers?: Buffer[];
  ownerName: string;
  ownerPhone?: string | null;
  ownerLineId?: string | null;
  ownerEmail: string;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const OUTER_PAD = 24;
const CARD_X = OUTER_PAD;
const CARD_W = PAGE_WIDTH - OUTER_PAD * 2;

const NAVY = '#1E293B';
const MUTED = '#94A3B8';

export class PetProfilePdfGenerator {
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

  private static getAssetPath(filename: string): string | null {
    const candidates = [
      path.join(__dirname, '../../assets/images', filename),
      path.join(process.cwd(), 'src/assets/images', filename),
      path.join(process.cwd(), 'dist/src/assets/images', filename),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  static async generate(data: PetProfilePdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
        info: {
          Title: `PAWND Pet Profile - ${data.name}`,
          Author: 'PAWND Network',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const regularFontPath = this.getFontPath('Sarabun-Regular.ttf');
      const boldFontPath = this.getFontPath('Sarabun-Bold.ttf');
      const hasThaiFont = Boolean(regularFontPath && boldFontPath);
      if (hasThaiFont && regularFontPath && boldFontPath) {
        doc.registerFont('ThaiRegular', regularFontPath);
        doc.registerFont('ThaiBold', boldFontPath);
      }

      this.renderProfile(doc, data, hasThaiFont);

      doc.end();
    });
  }

  private static renderProfile(
    doc: PDFKit.PDFDocument,
    data: PetProfilePdfData,
    hasThaiFont: boolean,
  ) {
    const boldFont = hasThaiFont ? 'ThaiBold' : 'Helvetica-Bold';
    const regFont = hasThaiFont ? 'ThaiRegular' : 'Helvetica';

    this.renderBackground(doc);
    const headerBottom = this.renderHeader(doc, boldFont);
    const cardBottom = this.renderMainCard(
      doc,
      data,
      boldFont,
      regFont,
      headerBottom + 16,
    );
    const bannerBottom = this.renderFamilyBanner(doc, cardBottom + 16);
    const contactBottom = this.renderContactBar(
      doc,
      data,
      boldFont,
      regFont,
      bannerBottom + 14,
    );

    doc
      .fillColor('#B08968')
      .fontSize(10)
      .font(boldFont)
      .text('— www.pawnd.app —', CARD_X, contactBottom + 16, {
        align: 'center',
        width: CARD_W,
      });
  }

  // ---------------------------------------------------------------------
  // Background
  // ---------------------------------------------------------------------

  private static renderBackground(doc: PDFKit.PDFDocument) {
    const grad = doc.linearGradient(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    grad.stop(0, '#FFF6E7').stop(1, '#FFE8C8');
    doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(grad);

    doc.fillOpacity(0.35);
    const corners: [number, number][] = [
      [46, 46],
      [PAGE_WIDTH - 46, 46],
      [46, PAGE_HEIGHT - 40],
      [PAGE_WIDTH - 46, PAGE_HEIGHT - 40],
    ];
    corners.forEach(([x, y]) => this.drawPaw(doc, x, y, 15, '#F0C687'));
    doc.fillOpacity(1);
  }

  // ---------------------------------------------------------------------
  // Header
  // ---------------------------------------------------------------------

  private static renderHeader(
    doc: PDFKit.PDFDocument,
    boldFont: string,
  ): number {
    const headerY = OUTER_PAD;
    const headerH = 90;

    const logoPath = this.getAssetPath('pawnd-logo.png');
    if (logoPath) {
      try {
        doc.image(logoPath, OUTER_PAD, headerY - 4, { fit: [88, 88] });
      } catch {
        // skip logo if unreadable
      }
    }

    const bannerX = OUTER_PAD + 108;
    const bannerW = PAGE_WIDTH - OUTER_PAD - bannerX;
    const bannerGrad = doc.linearGradient(
      bannerX,
      headerY,
      bannerX + bannerW,
      headerY + headerH,
    );
    bannerGrad.stop(0, '#FFD37A').stop(1, '#FFA53D');
    doc.roundedRect(bannerX, headerY, bannerW, headerH, 28).fill(bannerGrad);

    doc.fillOpacity(0.4);
    this.drawPaw(doc, bannerX + bannerW - 26, headerY + 22, 13, '#FFFFFF');
    doc.fillOpacity(1);

    doc
      .fillColor(NAVY)
      .fontSize(21)
      .font(boldFont)
      .text('โปรไฟล์สัตว์เลี้ยง', bannerX, headerY + 22, {
        align: 'center',
        width: bannerW,
      });
    doc.fontSize(12).text('(PET PROFILE)', bannerX, headerY + 52, {
      align: 'center',
      width: bannerW,
    });

    return headerY + headerH;
  }

  // ---------------------------------------------------------------------
  // Main card (photos + details)
  // ---------------------------------------------------------------------

  private static renderMainCard(
    doc: PDFKit.PDFDocument,
    data: PetProfilePdfData,
    boldFont: string,
    regFont: string,
    cardY: number,
  ): number {
    const cardH = 420;
    const padding = 22;

    doc.fillOpacity(0.12);
    doc.roundedRect(CARD_X + 3, cardY + 5, CARD_W, cardH, 24).fill('#7C5A2E');
    doc.fillOpacity(1);
    doc.roundedRect(CARD_X, cardY, CARD_W, cardH, 24).fill('#FFFFFF');

    const leftColX = CARD_X + padding;
    const leftColW = 230;
    const photoY = cardY + padding;
    const photoH = 250;

    this.renderClippedImage(
      doc,
      data.profileImageBuffer,
      leftColX,
      photoY,
      leftColW,
      photoH,
      16,
      boldFont,
    );

    const otherImages = (data.otherImageBuffers || []).slice(0, 2);
    if (otherImages.length > 0) {
      const thumbGap = 14;
      const thumbW = (leftColW - thumbGap) / 2;
      const thumbH = 110;
      const thumbY = photoY + photoH + 14;

      otherImages.forEach((buf, i) => {
        const x = leftColX + i * (thumbW + thumbGap);
        this.renderClippedImage(
          doc,
          buf,
          x,
          thumbY,
          thumbW,
          thumbH,
          12,
          boldFont,
          true,
        );
      });
    }

    const rightColX = leftColX + leftColW + 22;
    const rightColW = CARD_X + CARD_W - padding - rightColX;
    const rightY = photoY;

    const badgeR = 17;
    doc.circle(rightColX + badgeR, rightY + badgeR, badgeR).fill('#312E81');
    this.drawPaw(doc, rightColX + badgeR, rightY + badgeR, 9, '#FFFFFF');

    doc
      .fillColor(NAVY)
      .fontSize(21)
      .font(boldFont)
      .text(data.name, rightColX + badgeR * 2 + 10, rightY + badgeR - 12, {
        width: rightColW - badgeR * 2 - 10,
      });

    let detailStartY = rightY + badgeR * 2 + 12;

    if (data.distinctiveFeatures) {
      doc.fontSize(11).font(boldFont);
      const textW = doc.widthOfString(data.distinctiveFeatures);
      const pillPadX = 14;
      const pillW = Math.min(textW + pillPadX * 2, rightColW);
      const pillH = 24;
      const pillY = detailStartY;

      doc
        .roundedRect(rightColX, pillY, pillW, pillH, pillH / 2)
        .fill('#FFE3A3');
      doc
        .fillColor('#7A4A12')
        .text(data.distinctiveFeatures, rightColX, pillY + 6, {
          width: pillW,
          align: 'center',
        });

      detailStartY = pillY + pillH + 16;
    } else {
      detailStartY += 10;
    }

    const petTypeThai = this.translatePetType(data.type);
    const genderThai = this.translateGender(data.gender);

    const rows: {
      icon: (
        d: PDFKit.PDFDocument,
        cx: number,
        cy: number,
        r: number,
        c: string,
      ) => void;
      color: string;
      label: string;
      value: string;
    }[] = [
      {
        icon: (d, cx, cy, r, c) => this.drawPaw(d, cx, cy, r, c),
        color: '#8B5CF6',
        label: 'ชนิด / สายพันธุ์',
        value: `${petTypeThai}${data.breed ? ` (${data.breed})` : ''}`,
      },
      {
        icon: (d, cx, cy, r, c) =>
          this.drawGenderIcon(d, cx, cy, r, c, data.gender),
        color: '#EC4899',
        label: 'เพศ',
        value: genderThai,
      },
      {
        icon: (d, cx, cy, r, c) => this.drawPaletteIcon(d, cx, cy, r, c),
        color: '#3B82F6',
        label: 'สี',
        value: data.color || 'ไม่ระบุ',
      },
      {
        icon: (d, cx, cy, r, c) => this.drawCalendarIcon(d, cx, cy, r, c),
        color: '#22C55E',
        label: 'อายุ',
        value: data.age != null ? `${data.age} ปี` : 'ไม่ระบุ',
      },
      {
        icon: (d, cx, cy, r, c) => this.drawStarIcon(d, cx, cy, r, c),
        color: '#F97316',
        label: 'คำอธิบาย',
        value: data.description || 'ไม่ระบุ',
      },
    ];

    const cardBottom = cardY + cardH - padding;
    const availableH = cardBottom - detailStartY;
    const rowH = availableH / rows.length;

    rows.forEach((row, i) => {
      const rowY = detailStartY + i * rowH;
      const iconCX = rightColX + 14;
      const iconCY = rowY + 18;

      doc.circle(iconCX, iconCY, 14).fill(row.color);
      row.icon(doc, iconCX, iconCY, 8, '#FFFFFF');

      doc
        .fillColor(MUTED)
        .fontSize(9)
        .font(regFont)
        .text(row.label, rightColX + 36, rowY + 5, { width: rightColW - 36 });

      doc
        .fillColor('#111827')
        .fontSize(13)
        .font(boldFont)
        .text(row.value, rightColX + 36, rowY + 18, { width: rightColW - 36 });

      if (i < rows.length - 1) {
        doc.dash(2, { space: 2 });
        doc
          .strokeColor('#E5E7EB')
          .lineWidth(1)
          .moveTo(rightColX, rowY + rowH - 4)
          .lineTo(rightColX + rightColW, rowY + rowH - 4)
          .stroke();
        doc.undash();
      }
    });

    return cardY + cardH;
  }

  private static renderClippedImage(
    doc: PDFKit.PDFDocument,
    buffer: Buffer | null | undefined,
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
    boldFont: string,
    isThumb = false,
  ) {
    if (buffer) {
      try {
        doc.save();
        doc.roundedRect(x, y, w, h, radius).clip();
        doc.image(buffer, x, y, {
          cover: [w, h],
          align: 'center',
          valign: 'center',
        });
        doc.restore();
        return;
      } catch {
        // fall through to placeholder
      }
    }

    doc.roundedRect(x, y, w, h, radius).fillAndStroke('#EDE0C7', '#B8A17A');
    doc
      .fillColor('#6B4E34')
      .fontSize(isThumb ? 11 : 16)
      .font(boldFont)
      .text('ไม่มีรูปภาพ', x, y + h / 2 - 8, { align: 'center', width: w });
  }

  // ---------------------------------------------------------------------
  // Family banner image
  // ---------------------------------------------------------------------

  private static renderFamilyBanner(
    doc: PDFKit.PDFDocument,
    y: number,
  ): number {
    const bannerPath = this.getAssetPath('family-banner.png');
    if (!bannerPath) {
      return y;
    }

    try {
      doc.image(bannerPath, CARD_X, y, { width: CARD_W });
      const bannerH = CARD_W * (238 / 1254);
      return y + bannerH;
    } catch {
      return y;
    }
  }

  // ---------------------------------------------------------------------
  // Contact bar
  // ---------------------------------------------------------------------

  private static renderContactBar(
    doc: PDFKit.PDFDocument,
    data: PetProfilePdfData,
    boldFont: string,
    regFont: string,
    y: number,
  ): number {
    const barH = 104;
    doc.roundedRect(CARD_X, y, CARD_W, barH, 20).fill('#12263A');

    const items: {
      icon: (
        d: PDFKit.PDFDocument,
        cx: number,
        cy: number,
        r: number,
        c: string,
      ) => void;
      label: string;
      value: string;
      sub?: string;
    }[] = [
      {
        icon: (d, cx, cy, r, c) => this.drawPersonIcon(d, cx, cy, r, c),
        label: 'เจ้าของ',
        value: data.ownerName,
        sub: 'ติดต่อผ่านแอป PAWND',
      },
    ];

    if (data.ownerPhone) {
      items.push({
        icon: (d, cx, cy, r, c) => this.drawPhoneIcon(d, cx, cy, r, c),
        label: 'เบอร์โทร',
        value: data.ownerPhone,
      });
    }

    if (data.ownerLineId) {
      items.push({
        icon: (d, cx, cy, r, c) => this.drawChatIcon(d, cx, cy, r, c),
        label: 'LINE',
        value: data.ownerLineId,
      });
    }

    items.push({
      icon: (d, cx, cy, r, c) => this.drawEnvelopeIcon(d, cx, cy, r, c),
      label: 'อีเมล',
      value: data.ownerEmail,
    });

    const itemW = CARD_W / items.length;

    items.forEach((item, i) => {
      const ix = CARD_X + itemW * i;
      const iconCX = ix + 32;
      const iconCY = y + barH / 2 - (item.sub ? 8 : 0);

      doc.circle(iconCX, iconCY, 17).fill('#FFFFFF');
      item.icon(doc, iconCX, iconCY, 9, '#12263A');

      const textX = ix + 58;
      const textW = itemW - 66;

      doc
        .fillColor('#FBBF63')
        .fontSize(9)
        .font(regFont)
        .text(item.label, textX, y + 24, { width: textW });

      doc
        .fillColor('#FFFFFF')
        .fontSize(13)
        .font(boldFont)
        .text(item.value, textX, y + 39, { width: textW });

      if (item.sub) {
        doc
          .fillColor('#CBD5E1')
          .fontSize(8)
          .font(regFont)
          .text(item.sub, textX, y + 60, { width: textW });
      }

      if (i > 0) {
        doc
          .strokeColor('#FFFFFF33')
          .lineWidth(1)
          .moveTo(ix, y + 18)
          .lineTo(ix, y + barH - 18)
          .stroke();
      }
    });

    return y + barH;
  }

  // ---------------------------------------------------------------------
  // Hand-drawn vector icons (no icon font / SVG lib available)
  // ---------------------------------------------------------------------

  private static drawPaw(
    doc: PDFKit.PDFDocument,
    cx: number,
    cy: number,
    r: number,
    color: string,
  ) {
    doc.save();
    doc.fillColor(color);
    doc.ellipse(cx, cy + r * 0.15, r * 0.55, r * 0.45).fill();
    const toeOffsets: [number, number][] = [
      [-0.5, -0.55],
      [-0.18, -0.78],
      [0.18, -0.78],
      [0.5, -0.55],
    ];
    toeOffsets.forEach(([dx, dy]) => {
      doc.ellipse(cx + dx * r, cy + dy * r, r * 0.2, r * 0.26).fill();
    });
    doc.restore();
  }

  private static drawGenderIcon(
    doc: PDFKit.PDFDocument,
    cx: number,
    cy: number,
    r: number,
    color: string,
    gender?: string | null,
  ) {
    doc.save();
    doc.lineWidth(1.6).strokeColor(color);
    const circleR = r * 0.42;

    if (gender === 'FEMALE') {
      const ccy = cy - r * 0.3;
      doc.circle(cx, ccy, circleR).stroke();
      doc
        .moveTo(cx, ccy + circleR)
        .lineTo(cx, cy + r * 0.55)
        .stroke();
      doc
        .moveTo(cx - r * 0.28, cy + r * 0.32)
        .lineTo(cx + r * 0.28, cy + r * 0.32)
        .stroke();
    } else {
      const ccx = cx - r * 0.12;
      const ccy = cy + r * 0.12;
      doc.circle(ccx, ccy, circleR).stroke();
      const startX = ccx + circleR * 0.7;
      const startY = ccy - circleR * 0.7;
      const endX = cx + r * 0.5;
      const endY = cy - r * 0.5;
      doc.moveTo(startX, startY).lineTo(endX, endY).stroke();
      doc
        .moveTo(endX, endY)
        .lineTo(endX - r * 0.22, endY)
        .stroke();
      doc
        .moveTo(endX, endY)
        .lineTo(endX, endY + r * 0.22)
        .stroke();
    }
    doc.restore();
  }

  private static drawPaletteIcon(
    doc: PDFKit.PDFDocument,
    cx: number,
    cy: number,
    r: number,
    color: string,
  ) {
    doc.save();
    doc.lineWidth(1.4).strokeColor(color);
    doc.circle(cx, cy, r * 0.62).stroke();
    const dots: [number, number][] = [
      [-0.28, -0.12],
      [0.05, -0.32],
      [0.3, 0.05],
    ];
    doc.fillColor(color);
    dots.forEach(([dx, dy]) => {
      doc.circle(cx + dx * r * 1.6, cy + dy * r * 1.6, r * 0.14).fill();
    });
    doc.restore();
  }

  private static drawCalendarIcon(
    doc: PDFKit.PDFDocument,
    cx: number,
    cy: number,
    r: number,
    color: string,
  ) {
    doc.save();
    const w = r * 1.3;
    const h = r * 1.15;
    const x = cx - w / 2;
    const y = cy - h / 2 + r * 0.1;

    doc.lineWidth(1.4).strokeColor(color);
    doc.roundedRect(x, y, w, h, 1.5).stroke();
    doc
      .moveTo(x, y + h * 0.35)
      .lineTo(x + w, y + h * 0.35)
      .stroke();
    doc
      .moveTo(x + w * 0.28, y - h * 0.12)
      .lineTo(x + w * 0.28, y + h * 0.12)
      .stroke();
    doc
      .moveTo(x + w * 0.72, y - h * 0.12)
      .lineTo(x + w * 0.72, y + h * 0.12)
      .stroke();
    doc.restore();
  }

  private static drawStarIcon(
    doc: PDFKit.PDFDocument,
    cx: number,
    cy: number,
    r: number,
    color: string,
  ) {
    doc.save();
    doc.fillColor(color);
    const points = this.starPoints(cx, cy, r, r * 0.42, 5, -90);
    doc.polygon(...points).fill();
    doc.restore();
  }

  private static drawPersonIcon(
    doc: PDFKit.PDFDocument,
    cx: number,
    cy: number,
    r: number,
    color: string,
  ) {
    doc.save();
    doc.fillColor(color);
    doc.circle(cx, cy - r * 0.42, r * 0.34).fill();
    doc
      .moveTo(cx - r * 0.55, cy + r * 0.6)
      .bezierCurveTo(
        cx - r * 0.55,
        cy,
        cx + r * 0.55,
        cy,
        cx + r * 0.55,
        cy + r * 0.6,
      )
      .lineTo(cx - r * 0.55, cy + r * 0.6)
      .fill();
    doc.restore();
  }

  private static drawEnvelopeIcon(
    doc: PDFKit.PDFDocument,
    cx: number,
    cy: number,
    r: number,
    color: string,
  ) {
    doc.save();
    const w = r * 1.4;
    const h = r;
    const x = cx - w / 2;
    const y = cy - h / 2;

    doc.lineWidth(1.4).strokeColor(color);
    doc.roundedRect(x, y, w, h, 1.5).stroke();
    doc
      .moveTo(x, y)
      .lineTo(x + w / 2, y + h * 0.58)
      .lineTo(x + w, y)
      .stroke();
    doc.restore();
  }

  private static drawPhoneIcon(
    doc: PDFKit.PDFDocument,
    cx: number,
    cy: number,
    r: number,
    color: string,
  ) {
    doc.save();
    doc.fillColor(color);
    const w = r * 0.9;
    const h = r * 1.5;
    doc.roundedRect(cx - w / 2, cy - h / 2, w, h, w * 0.3).fill();
    doc.restore();
  }

  private static drawChatIcon(
    doc: PDFKit.PDFDocument,
    cx: number,
    cy: number,
    r: number,
    color: string,
  ) {
    doc.save();
    doc.fillColor(color);
    const w = r * 1.5;
    const h = r * 1.05;
    const x = cx - w / 2;
    const y = cy - h / 2 - r * 0.08;

    doc.roundedRect(x, y, w, h, h * 0.35).fill();
    doc
      .moveTo(x + w * 0.22, y + h)
      .lineTo(x + w * 0.12, y + h + r * 0.3)
      .lineTo(x + w * 0.42, y + h)
      .fill();
    doc.restore();
  }

  private static starPoints(
    cx: number,
    cy: number,
    outerR: number,
    innerR: number,
    spikes: number,
    rotationDeg: number,
  ): number[][] {
    const step = Math.PI / spikes;
    let angle = (rotationDeg * Math.PI) / 180;
    const pts: number[][] = [];
    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerR : innerR;
      pts.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
      angle += step;
    }
    return pts;
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
}
