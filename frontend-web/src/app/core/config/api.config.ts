import { environment } from '../../../environments/environment';

export const API_BASE_URL = environment.apiBaseUrl;
export const OFFICIAL_CATEGORIES = ['POLERA', 'CAMISA', 'POLO', 'BLUSA'] as const;
export const MEN_CATEGORIES = ['POLERA', 'CAMISA', 'POLO'] as const;
export const WOMEN_CATEGORIES = OFFICIAL_CATEGORIES;
