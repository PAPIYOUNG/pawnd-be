import { PetType } from '@/database/generated/prisma/enums';
import { AiAnalysisResult } from './types/ai-analysis-result.type';

export const MOCK_AI_ANALYSIS_RESULT: AiAnalysisResult = {
  type: PetType.DOG,
  breed: 'สุนัขพันธุ์ผสม',
  color: 'ขนสีน้ำตาลอ่อนและสีขาว มีแต้มสีเข้มบริเวณใบหน้า',
  distinctiveFeatures: 'มีปลอกคอสีน้ำเงินและปื้นสีขาวบริเวณหน้าอก',
  description:
    'สุนัขขนสั้นสีน้ำตาลอ่อนสลับขาว มีแต้มสีเข้มบนใบหน้า ปื้นสีขาวบริเวณหน้าอก และสวมปลอกคอสีน้ำเงิน',
};

export function createMockImageEmbedding(
  source: string,
  dimension: number,
): number[] {
  let hash = 2166136261;

  for (const character of source) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  const values = Array.from({ length: dimension }, (_, index) => {
    const mixed = Math.imul(hash ^ index, 2246822519);
    return ((mixed >>> 0) / 4294967295) * 2 - 1;
  });

  const magnitude = Math.sqrt(
    values.reduce((sum, value) => sum + value * value, 0),
  );

  return values.map((value) => value / magnitude);
}

export function createMockPetAvatarDataUrl(): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
      <rect width="512" height="512" rx="96" fill="#EAF4FF"/>
      <circle cx="256" cy="256" r="150" fill="#B8794A"/>
      <path d="M145 175 90 100l100 42M367 175l55-75-100 42" fill="#9B5F39"/>
      <circle cx="205" cy="240" r="18" fill="#252525"/>
      <circle cx="307" cy="240" r="18" fill="#252525"/>
      <path d="M226 315q30 25 60 0" fill="none" stroke="#252525" stroke-width="12" stroke-linecap="round"/>
      <path d="M160 345h192" stroke="#3F8CC9" stroke-width="22" stroke-linecap="round"/>
      <text x="256" y="450" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" fill="#25608F">PAWND MOCK</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
