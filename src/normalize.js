/**
 * Utility functions for normalizing real estate data
 * from Kenyan and EAC classifieds
 */

// Exchange rate for KES to USD (approximate)
const KES_TO_USD_RATE = 0.0064;
const USD_TO_KES_RATE = 156.25;

/**
 * Normalize price to a consistent format
 * @param {string|number} priceStr - Raw price string from listing
 * @param {string} targetCurrency - Target currency (KES or USD)
 * @returns {object} Normalized price object
 */
export function normalizePrice(priceStr, targetCurrency = 'KES') {
    if (!priceStr) {
        return { amount: null, currency: targetCurrency, original: null };
    }

    const original = String(priceStr).trim();
    let amount = null;
    let sourceCurrency = 'KES';

    // Remove common formatting
    let cleaned = original.toUpperCase()
        .replace(/[,\s]/g, '')
        .replace(/KSH|KES|SH|\/=|SHILLINGS?/gi, '')
        .replace(/USD|\$/gi, () => { sourceCurrency = 'USD'; return ''; })
        .trim();

    // Extract numeric value
    const numMatch = cleaned.match(/[\d.]+/);
    if (numMatch) {
        amount = parseFloat(numMatch[0]);

        // Handle K (thousands) and M (millions) suffixes
        if (cleaned.includes('M')) {
            amount *= 1000000;
        } else if (cleaned.includes('K')) {
            amount *= 1000;
        }
    }

    // Convert to target currency if needed
    if (amount !== null && sourceCurrency !== targetCurrency) {
        if (sourceCurrency === 'KES' && targetCurrency === 'USD') {
            amount = Math.round(amount * KES_TO_USD_RATE * 100) / 100;
        } else if (sourceCurrency === 'USD' && targetCurrency === 'KES') {
            amount = Math.round(amount * USD_TO_KES_RATE);
        }
    }

    return {
        amount,
        currency: targetCurrency,
        original
    };
}

/**
 * Normalize location string
 * @param {string} locationStr - Raw location from listing
 * @returns {object} Normalized location object
 */
export function normalizeLocation(locationStr) {
    if (!locationStr) {
        return { area: null, city: null, region: null, original: null };
    }

    const original = String(locationStr).trim();
    const cleaned = original.replace(/[,\-\/]/g, ',').trim();
    const parts = cleaned.split(',').map(p => p.trim()).filter(Boolean);

    // Common Kenyan cities and regions for mapping
    const kenyaCities = [
        'nairobi', 'mombasa', 'kisumu', 'nakuru', 'eldoret',
        'thika', 'malindi', 'kitale', 'machakos', 'nyeri',
        'naivasha', 'nanyuki', 'kiambu', 'kajiado', 'kilifi',
        'lamu', 'garissa', 'kakamega', 'bungoma', 'embu'
    ];

    const regions = {
        nairobi: 'Nairobi',
        mombasa: 'Coast',
        kisumu: 'Nyanza',
        nakuru: 'Rift Valley',
        eldoret: 'Rift Valley',
        thika: 'Central',
        malindi: 'Coast',
        kitale: 'Rift Valley',
        machakos: 'Eastern',
        nyeri: 'Central',
        naivasha: 'Rift Valley',
        nanyuki: 'Central',
        kiambu: 'Central',
        kajiado: 'Rift Valley',
        kilifi: 'Coast',
        lamu: 'Coast',
        garissa: 'North Eastern',
        kakamega: 'Western',
        bungoma: 'Western',
        embu: 'Eastern'
    };

    let city = null;
    let region = null;
    let area = null;

    // Try to identify city from parts
    for (const part of parts) {
        const lowerPart = part.toLowerCase();
        for (const knownCity of kenyaCities) {
            if (lowerPart.includes(knownCity)) {
                city = knownCity.charAt(0).toUpperCase() + knownCity.slice(1);
                region = regions[knownCity] || null;
                break;
            }
        }
        if (city) break;
    }

    // First part is usually the area/neighborhood
    if (parts.length > 0) {
        area = parts[0];
    }

    return {
        area,
        city,
        region,
        original
    };
}

/**
 * Normalize contact information
 * @param {object} contactData - Raw contact data
 * @returns {object} Normalized contact object
 */
export function normalizeContact(contactData) {
    const result = {
        name: null,
        phone: [],
        email: null,
        whatsapp: null
    };

    if (!contactData) {
        return result;
    }

    if (typeof contactData === 'string') {
        // Try to extract phone number from string
        const phones = extractPhoneNumbers(contactData);
        result.phone = phones;
        const email = extractEmail(contactData);
        if (email) result.email = email;
        return result;
    }

    result.name = contactData.name || contactData.agentName || null;

    // Extract phone numbers
    const phoneStr = contactData.phone || contactData.phoneNumber || contactData.mobile || '';
    result.phone = extractPhoneNumbers(phoneStr);

    // WhatsApp
    if (contactData.whatsapp) {
        const whatsappNumbers = extractPhoneNumbers(contactData.whatsapp);
        result.whatsapp = whatsappNumbers[0] || null;
    }

    // Email
    result.email = extractEmail(contactData.email || contactData.mail || '');

    return result;
}

/**
 * Extract phone numbers from a string
 * @param {string} str - String containing phone numbers
 * @returns {string[]} Array of normalized phone numbers
 */
function extractPhoneNumbers(str) {
    if (!str) return [];

    const phones = [];
    // Match Kenyan phone patterns: 07xx, 01xx, +254, 254
    const matches = String(str).match(/(\+?254|0)?[17]\d{8}/g) || [];

    for (const match of matches) {
        let normalized = match.replace(/[\s\-\(\)]/g, '');
        // Normalize to +254 format
        if (normalized.startsWith('0')) {
            normalized = '+254' + normalized.slice(1);
        } else if (normalized.startsWith('254')) {
            normalized = '+' + normalized;
        } else if (!normalized.startsWith('+')) {
            normalized = '+254' + normalized;
        }
        if (!phones.includes(normalized)) {
            phones.push(normalized);
        }
    }

    return phones;
}

/**
 * Extract email from string
 * @param {string} str - String containing email
 * @returns {string|null} Email address or null
 */
function extractEmail(str) {
    if (!str) return null;
    const match = String(str).match(/[\w.-]+@[\w.-]+\.\w+/);
    return match ? match[0].toLowerCase() : null;
}

/**
 * Normalize image URLs
 * @param {string|string[]} images - Raw image URLs
 * @returns {string[]} Array of normalized image URLs
 */
export function normalizeImages(images) {
    if (!images) return [];

    const imageArray = Array.isArray(images) ? images : [images];
    return imageArray
        .filter(img => img && typeof img === 'string')
        .map(img => {
            let url = img.trim();
            // Ensure absolute URL
            if (url.startsWith('//')) {
                url = 'https:' + url;
            }
            // Remove query params for thumbnails if full image available
            url = url.replace(/-thumb\.\w+$/, '.$1');
            return url;
        })
        .filter(url => url.startsWith('http'));
}

/**
 * Normalize a complete listing
 * @param {object} rawListing - Raw listing data
 * @param {string} source - Source website
 * @param {string} targetCurrency - Target currency for prices
 * @returns {object} Normalized listing
 */
export function normalizeListing(rawListing, source, targetCurrency = 'KES') {
    return {
        id: rawListing.id || rawListing.listingId || null,
        source,
        url: rawListing.url || null,
        title: rawListing.title?.trim() || null,
        description: rawListing.description?.trim() || null,
        listingType: normalizeListingType(rawListing.listingType || rawListing.type),
        propertyType: normalizePropertyType(rawListing.propertyType || rawListing.category),
        price: normalizePrice(rawListing.price, targetCurrency),
        location: normalizeLocation(rawListing.location || rawListing.address),
        contact: normalizeContact(rawListing.contact || rawListing.agent),
        images: normalizeImages(rawListing.images || rawListing.photos),
        features: {
            bedrooms: parseNumber(rawListing.bedrooms || rawListing.beds),
            bathrooms: parseNumber(rawListing.bathrooms || rawListing.baths),
            size: parseSize(rawListing.size || rawListing.area),
            parking: rawListing.parking || null,
            furnished: rawListing.furnished || null
        },
        postedAt: rawListing.postedAt || rawListing.datePosted || null,
        scrapedAt: new Date().toISOString()
    };
}

/**
 * Normalize listing type
 */
function normalizeListingType(type) {
    if (!type) return 'unknown';
    const t = String(type).toLowerCase();
    if (t.includes('sale') || t.includes('buy')) return 'sale';
    if (t.includes('rent') || t.includes('let')) return 'rent';
    return 'unknown';
}

/**
 * Normalize property type
 */
function normalizePropertyType(type) {
    if (!type) return 'unknown';
    const t = String(type).toLowerCase();
    if (t.includes('house') || t.includes('villa') || t.includes('bungalow') || t.includes('townhouse')) return 'house';
    if (t.includes('apartment') || t.includes('flat') || t.includes('studio') || t.includes('bedsitter')) return 'apartment';
    if (t.includes('land') || t.includes('plot')) return 'land';
    if (t.includes('commercial') || t.includes('office') || t.includes('shop') || t.includes('warehouse')) return 'commercial';
    return 'other';
}

/**
 * Parse a number from string
 */
function parseNumber(val) {
    if (val === null || val === undefined) return null;
    const num = parseInt(String(val), 10);
    return isNaN(num) ? null : num;
}

/**
 * Parse size/area string
 */
function parseSize(sizeStr) {
    if (!sizeStr) return { value: null, unit: null };
    const str = String(sizeStr).toLowerCase();
    const match = str.match(/([\d,.]+)\s*(sqft|sq\.?\s*ft|sqm|sq\.?\s*m|acres?|hectares?)/i);
    if (match) {
        return {
            value: parseFloat(match[1].replace(/,/g, '')),
            unit: match[2].replace(/\./g, '').replace(/\s/g, '').toLowerCase()
        };
    }
    return { value: null, unit: null };
}
