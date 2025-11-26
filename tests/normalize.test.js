/**
 * Tests for normalization utilities
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
    normalizePrice,
    normalizeLocation,
    normalizeContact,
    normalizeImages,
    normalizeListing
} from '../src/normalize.js';

describe('normalizePrice', () => {
    it('should parse KES prices correctly', () => {
        const result = normalizePrice('KES 5,000,000');
        assert.strictEqual(result.amount, 5000000);
        assert.strictEqual(result.currency, 'KES');
        assert.strictEqual(result.original, 'KES 5,000,000');
    });

    it('should handle K suffix (thousands)', () => {
        const result = normalizePrice('500K');
        assert.strictEqual(result.amount, 500000);
    });

    it('should handle M suffix (millions)', () => {
        const result = normalizePrice('2.5M');
        assert.strictEqual(result.amount, 2500000);
    });

    it('should handle KSH prefix', () => {
        const result = normalizePrice('KSH 10,000');
        assert.strictEqual(result.amount, 10000);
    });

    it('should convert USD to KES', () => {
        const result = normalizePrice('$1000', 'KES');
        assert.strictEqual(result.amount, 156250);
        assert.strictEqual(result.currency, 'KES');
    });

    it('should convert KES to USD', () => {
        const result = normalizePrice('KES 156250', 'USD');
        assert.strictEqual(result.amount, 1000);
        assert.strictEqual(result.currency, 'USD');
    });

    it('should handle null input', () => {
        const result = normalizePrice(null);
        assert.strictEqual(result.amount, null);
        assert.strictEqual(result.original, null);
    });

    it('should handle various KES formats', () => {
        assert.strictEqual(normalizePrice('Ksh 50000').amount, 50000);
        assert.strictEqual(normalizePrice('50,000/=').amount, 50000);
        assert.strictEqual(normalizePrice('SH 50000').amount, 50000);
    });
});

describe('normalizeLocation', () => {
    it('should extract city from location string', () => {
        const result = normalizeLocation('Westlands, Nairobi');
        assert.strictEqual(result.city, 'Nairobi');
        assert.strictEqual(result.area, 'Westlands');
        assert.strictEqual(result.region, 'Nairobi');
    });

    it('should handle Mombasa locations', () => {
        const result = normalizeLocation('Nyali, Mombasa');
        assert.strictEqual(result.city, 'Mombasa');
        assert.strictEqual(result.region, 'Coast');
    });

    it('should handle Kisumu locations', () => {
        const result = normalizeLocation('Milimani - Kisumu');
        assert.strictEqual(result.city, 'Kisumu');
        assert.strictEqual(result.region, 'Nyanza');
    });

    it('should handle null input', () => {
        const result = normalizeLocation(null);
        assert.strictEqual(result.area, null);
        assert.strictEqual(result.city, null);
    });

    it('should preserve original string', () => {
        const result = normalizeLocation('Karen, Nairobi');
        assert.strictEqual(result.original, 'Karen, Nairobi');
    });
});

describe('normalizeContact', () => {
    it('should extract Kenyan phone numbers', () => {
        const result = normalizeContact({ phone: '0722123456' });
        assert.deepStrictEqual(result.phone, ['+254722123456']);
    });

    it('should handle +254 format', () => {
        const result = normalizeContact({ phone: '+254722123456' });
        assert.deepStrictEqual(result.phone, ['+254722123456']);
    });

    it('should handle 254 format without plus', () => {
        const result = normalizeContact({ phone: '254722123456' });
        assert.deepStrictEqual(result.phone, ['+254722123456']);
    });

    it('should extract multiple phone numbers', () => {
        const result = normalizeContact({ phone: '0722123456, 0733987654' });
        assert.strictEqual(result.phone.length, 2);
    });

    it('should extract email', () => {
        const result = normalizeContact({ email: 'test@example.com' });
        assert.strictEqual(result.email, 'test@example.com');
    });

    it('should extract name', () => {
        const result = normalizeContact({ name: 'John Agent' });
        assert.strictEqual(result.name, 'John Agent');
    });

    it('should handle string input', () => {
        const result = normalizeContact('Call 0722123456');
        assert.deepStrictEqual(result.phone, ['+254722123456']);
    });
});

describe('normalizeImages', () => {
    it('should return array of image URLs', () => {
        const result = normalizeImages(['https://example.com/img1.jpg', 'https://example.com/img2.jpg']);
        assert.strictEqual(result.length, 2);
    });

    it('should handle single image string', () => {
        const result = normalizeImages('https://example.com/img.jpg');
        assert.strictEqual(result.length, 1);
    });

    it('should add https to protocol-relative URLs', () => {
        const result = normalizeImages('//example.com/img.jpg');
        assert.strictEqual(result[0], 'https://example.com/img.jpg');
    });

    it('should filter out invalid URLs', () => {
        const result = normalizeImages(['https://example.com/img.jpg', '', null, 'not-a-url']);
        assert.strictEqual(result.length, 1);
    });

    it('should handle null input', () => {
        const result = normalizeImages(null);
        assert.deepStrictEqual(result, []);
    });
});

describe('normalizeListing', () => {
    it('should normalize a complete listing', () => {
        const rawListing = {
            id: '12345',
            url: 'https://example.com/listing/12345',
            title: '3 Bedroom House for Sale',
            description: 'Beautiful house in Westlands',
            listingType: 'sale',
            propertyType: 'house',
            price: 'KES 15,000,000',
            location: 'Westlands, Nairobi',
            contact: { name: 'John Agent', phone: '0722123456' },
            images: ['https://example.com/img1.jpg'],
            bedrooms: '3',
            bathrooms: '2'
        };

        const result = normalizeListing(rawListing, 'buyrentkenya', 'KES');

        assert.strictEqual(result.id, '12345');
        assert.strictEqual(result.source, 'buyrentkenya');
        assert.strictEqual(result.title, '3 Bedroom House for Sale');
        assert.strictEqual(result.listingType, 'sale');
        assert.strictEqual(result.propertyType, 'house');
        assert.strictEqual(result.price.amount, 15000000);
        assert.strictEqual(result.location.city, 'Nairobi');
        assert.strictEqual(result.contact.phone[0], '+254722123456');
        assert.strictEqual(result.features.bedrooms, 3);
        assert.strictEqual(result.features.bathrooms, 2);
        assert.ok(result.scrapedAt);
    });

    it('should normalize listing type correctly', () => {
        const saleListing = normalizeListing({ listingType: 'for sale' }, 'jiji');
        assert.strictEqual(saleListing.listingType, 'sale');

        const rentListing = normalizeListing({ listingType: 'for rent' }, 'jiji');
        assert.strictEqual(rentListing.listingType, 'rent');
    });

    it('should normalize property type correctly', () => {
        const house = normalizeListing({ propertyType: 'townhouse' }, 'jiji');
        assert.strictEqual(house.propertyType, 'house');

        const apt = normalizeListing({ propertyType: 'studio apartment' }, 'jiji');
        assert.strictEqual(apt.propertyType, 'apartment');

        const land = normalizeListing({ propertyType: 'land plot' }, 'jiji');
        assert.strictEqual(land.propertyType, 'land');

        const commercial = normalizeListing({ propertyType: 'office space' }, 'jiji');
        assert.strictEqual(commercial.propertyType, 'commercial');
    });
});
