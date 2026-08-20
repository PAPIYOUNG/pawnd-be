import { ReverseGeocodeLanguage } from '../dto/reverse-geocode-query.dto';

export const GEOCODING_PROVIDER = Symbol('GEOCODING_PROVIDER');
export const GEOCODING_CLOCK = Symbol('GEOCODING_CLOCK');
export const GEOCODING_SLEEPER = Symbol('GEOCODING_SLEEPER');
export const NOMINATIM_FETCH = Symbol('NOMINATIM_FETCH');

export type ReverseGeocodeInput = {
  latitude: number;
  longitude: number;
  language: ReverseGeocodeLanguage;
};

export type ReverseGeocodeResult = {
  displayName: string;
  address: {
    road: string | null;
    neighbourhood: string | null;
    subdistrict: string | null;
    district: string | null;
    province: string | null;
    postcode: string | null;
    country: string | null;
    countryCode: string | null;
  };
  source: 'nominatim';
  attribution: 'Data © OpenStreetMap contributors';
};

export interface GeocodingProvider {
  reverseGeocode(input: ReverseGeocodeInput): Promise<ReverseGeocodeResult>;
}

export interface GeocodingClock {
  now(): number;
}

export interface GeocodingSleeper {
  sleep(milliseconds: number): Promise<void>;
}

export type GeocodingFetch = typeof fetch;
