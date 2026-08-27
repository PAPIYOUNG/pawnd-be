/// <reference types="jest" />

import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { SearchByImageDto } from './search-by-image.dto';
import { PostType } from '@/database/generated/prisma/enums';

describe('SearchByImageDto', () => {
  it('defaults limit to 10 when omitted', () => {
    const dto = plainToInstance(SearchByImageDto, {});

    expect(dto.limit).toBe(10);
  });

  it('accepts a valid limit and postType', async () => {
    const dto = plainToInstance(SearchByImageDto, {
      limit: '5',
      postType: PostType.LOST,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(5);
  });

  it('rejects a limit above the maximum', async () => {
    const dto = plainToInstance(SearchByImageDto, { limit: '31' });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('limit');
  });

  it('rejects a limit below the minimum', async () => {
    const dto = plainToInstance(SearchByImageDto, { limit: '0' });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('limit');
  });

  it('rejects an invalid postType', async () => {
    const dto = plainToInstance(SearchByImageDto, { postType: 'MISSING' });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('postType');
  });
});
