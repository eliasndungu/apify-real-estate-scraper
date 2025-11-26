/**
 * Jiji Kenya Scraper
 * Scrapes real estate listings from jiji.co.ke
 */

import { CheerioCrawler } from 'crawlee';
import { normalizeListing } from './normalize.js';

const BASE_URL = 'https://jiji.co.ke';

/**
 * Build search URL based on filters
 */
function buildSearchUrl(options) {
    const { listingType, propertyType, location } = options;

    let path = '/real-estate';

    if (propertyType && propertyType !== 'all') {
        const typeMap = {
            house: 'houses-apartments-for-sale',
            apartment: 'houses-apartments-for-rent',
            land: 'land-and-plots-for-sale',
            commercial: 'commercial-property-for-sale'
        };

        if (listingType === 'rent') {
            path = '/houses-apartments-for-rent';
        } else if (listingType === 'sale') {
            path = '/' + (typeMap[propertyType] || 'houses-apartments-for-sale');
        } else {
            path = '/' + (typeMap[propertyType] || 'real-estate');
        }
    } else if (listingType === 'rent') {
        path = '/houses-apartments-for-rent';
    } else if (listingType === 'sale') {
        path = '/houses-apartments-for-sale';
    }

    if (location) {
        path += '/' + location.toLowerCase().replace(/\s+/g, '-');
    }

    return `${BASE_URL}${path}`;
}

/**
 * Extract listing data from Jiji detail page
 */
function extractListingFromPage($, url) {
    const listing = {};

    listing.url = url;
    listing.id = url.match(/\/(\d+)\.html/)?.[1] || url.split('/').pop()?.replace('.html', '') || null;

    // Title
    listing.title = $('h1.qa-advert-title, h1[class*="title"]').first().text().trim() ||
                    $('meta[property="og:title"]').attr('content') || '';

    // Description
    listing.description = $('.qa-advert-description, .description, [class*="description"]').first().text().trim();

    // Price
    listing.price = $('.qa-advert-price, .price, [class*="price"]').first().text().trim();

    // Location
    listing.location = $('.qa-advert-location, .location, [class*="region"]').first().text().trim() ||
                       $('meta[property="og:locality"]').attr('content') || '';

    // Listing type (sale/rent)
    const breadcrumb = $('.breadcrumbs, .breadcrumb').text().toLowerCase();
    const titleLower = listing.title.toLowerCase();
    if (breadcrumb.includes('for-sale') || titleLower.includes('for sale')) {
        listing.listingType = 'sale';
    } else if (breadcrumb.includes('for-rent') || titleLower.includes('for rent')) {
        listing.listingType = 'rent';
    }

    // Property type from breadcrumb/category
    const category = $('.category, .breadcrumb-item').text().toLowerCase();
    listing.propertyType = category || 'house';

    // Features - Jiji typically has these in attributes section
    const attributes = {};
    $('.qa-advert-attributes li, .attribute-item, [class*="attribute"]').each((i, el) => {
        const text = $(el).text().toLowerCase();
        if (text.includes('bedroom') || text.includes('bed')) {
            attributes.bedrooms = text.match(/\d+/)?.[0];
        } else if (text.includes('bathroom') || text.includes('bath')) {
            attributes.bathrooms = text.match(/\d+/)?.[0];
        } else if (text.includes('sqm') || text.includes('sq ft') || text.includes('acre')) {
            attributes.size = text;
        }
    });

    listing.bedrooms = attributes.bedrooms || null;
    listing.bathrooms = attributes.bathrooms || null;
    listing.size = attributes.size || null;

    // Images
    listing.images = [];
    $('img.qa-advert-image, .gallery img, [class*="gallery"] img, .advert-image img').each((i, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src');
        if (src && !src.includes('avatar') && !src.includes('logo') && !src.includes('placeholder')) {
            listing.images.push(src);
        }
    });

    // Also check for image data in JSON-LD
    $('script[type="application/ld+json"]').each((i, el) => {
        try {
            const json = JSON.parse($(el).html());
            if (json.image) {
                const imgs = Array.isArray(json.image) ? json.image : [json.image];
                listing.images.push(...imgs.filter(img => typeof img === 'string'));
            }
        } catch {
            // Ignore JSON parse errors
        }
    });

    // Contact info
    listing.contact = {
        name: $('.qa-seller-name, .seller-name, [class*="seller"]').first().text().trim(),
        phone: $('.qa-seller-phone, .seller-phone, [class*="phone"]').first().text().trim()
    };

    // Posted date
    listing.postedAt = $('.qa-advert-date, .date-posted, [class*="date"]').first().text().trim();

    return listing;
}

/**
 * Create Jiji crawler
 */
export function createJijiCrawler(options = {}) {
    const { maxListings = 100, currency = 'KES' } = options;
    const listings = [];
    let listingCount = 0;

    const crawler = new CheerioCrawler({
        maxRequestsPerCrawl: maxListings + 50,
        requestHandlerTimeoutSecs: 60,

        async requestHandler({ request, $, enqueueLinks, log }) {
            const url = request.url;

            if (request.label === 'DETAIL') {
                // Detail page
                if (listingCount >= maxListings) return;

                const rawListing = extractListingFromPage($, url);
                const normalizedListing = normalizeListing(rawListing, 'jiji', currency);
                listings.push(normalizedListing);
                listingCount++;

                log.info(`Scraped listing ${listingCount}/${maxListings}: ${normalizedListing.title || url}`);
            } else {
                // Listing page
                log.info(`Processing listing page: ${url}`);

                // Find listing links - Jiji uses various card formats
                const propertyLinks = [];
                $('a[href*="/item/"], .qa-advert-list-item a, .listing-card a, [class*="advert"] a').each((i, el) => {
                    const href = $(el).attr('href');
                    if (href && href.includes('/item/') && !propertyLinks.includes(href)) {
                        if (listingCount + propertyLinks.length < maxListings) {
                            const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
                            propertyLinks.push(fullUrl);
                        }
                    }
                });

                // Enqueue detail pages
                for (const link of propertyLinks) {
                    await crawler.addRequests([{ url: link, label: 'DETAIL' }]);
                }

                // Pagination
                if (listingCount + propertyLinks.length < maxListings) {
                    await enqueueLinks({
                        selector: 'a.qa-pagination-next, a[rel="next"], .pagination a:contains("Next"), a[class*="next"]',
                        label: 'LIST'
                    });
                }
            }
        },

        failedRequestHandler({ request, log }) {
            log.error(`Request failed: ${request.url}`);
        }
    });

    return {
        crawler,
        getListings: () => listings,
        buildSearchUrl: (opts) => buildSearchUrl({ ...options, ...opts })
    };
}

export default {
    createCrawler: createJijiCrawler,
    buildSearchUrl
};
