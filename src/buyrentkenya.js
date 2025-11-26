/**
 * BuyRentKenya Scraper
 * Scrapes real estate listings from buyrentkenya.com
 */

import { CheerioCrawler } from 'crawlee';
import { normalizeListing } from './normalize.js';

const BASE_URL = 'https://www.buyrentkenya.com';

/**
 * Build search URL based on filters
 */
function buildSearchUrl(options) {
    const { listingType, propertyType, location } = options;

    let path = '/property';

    if (listingType === 'sale') {
        path = '/houses-for-sale';
    } else if (listingType === 'rent') {
        path = '/houses-for-rent';
    }

    if (propertyType && propertyType !== 'all') {
        const typeMap = {
            house: 'houses',
            apartment: 'apartments',
            land: 'land',
            commercial: 'commercial'
        };
        path = path.replace('houses', typeMap[propertyType] || 'houses');
    }

    if (location) {
        path += `-${location.toLowerCase().replace(/\s+/g, '-')}`;
    }

    return `${BASE_URL}${path}`;
}

/**
 * Extract listing data from detail page
 */
function extractListingFromPage($, url) {
    const listing = {};

    listing.url = url;
    listing.id = url.match(/\/(\d+)\/?$/)?.[1] || null;

    // Title and description
    listing.title = $('h1.property-title, h1[class*="title"]').first().text().trim() ||
                    $('meta[property="og:title"]').attr('content') || '';
    listing.description = $('.property-description, .description, [class*="description"]').first().text().trim();

    // Price
    listing.price = $('.property-price, .price, [class*="price"]').first().text().trim();

    // Location
    listing.location = $('.property-location, .location, [class*="location"]').first().text().trim() ||
                       $('meta[property="og:locality"]').attr('content') || '';

    // Listing type (sale/rent)
    const pageText = $('body').text().toLowerCase();
    if (pageText.includes('for sale') || url.includes('for-sale')) {
        listing.listingType = 'sale';
    } else if (pageText.includes('for rent') || url.includes('for-rent')) {
        listing.listingType = 'rent';
    }

    // Property type
    const propertyTypeEl = $('.property-type, [class*="property-type"]').first().text().toLowerCase();
    listing.propertyType = propertyTypeEl || 'house';

    // Features
    listing.bedrooms = $('.bedrooms, [class*="bed"]').first().text().match(/\d+/)?.[0] || null;
    listing.bathrooms = $('.bathrooms, [class*="bath"]').first().text().match(/\d+/)?.[0] || null;
    listing.size = $('.property-size, .size, [class*="size"]').first().text().trim();

    // Images
    listing.images = [];
    $('img[src*="property"], img[src*="listing"], .gallery img, .property-images img').each((i, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src');
        if (src && !src.includes('avatar') && !src.includes('logo')) {
            listing.images.push(src);
        }
    });

    // Contact info
    listing.contact = {
        name: $('.agent-name, .contact-name, [class*="agent"]').first().text().trim(),
        phone: $('.agent-phone, .contact-phone, [class*="phone"]').first().text().trim()
    };

    // Posted date
    listing.postedAt = $('.posted-date, .date, [class*="date"]').first().text().trim();

    return listing;
}

/**
 * Create BuyRentKenya crawler
 */
export function createBuyRentKenyaCrawler(options = {}) {
    const { maxListings = 100, currency = 'KES' } = options;
    const listings = [];
    let listingCount = 0;

    const crawler = new CheerioCrawler({
        maxRequestsPerCrawl: maxListings + 50, // Extra for pagination
        requestHandlerTimeoutSecs: 60,

        async requestHandler({ request, $, enqueueLinks, log }) {
            const url = request.url;

            if (request.label === 'DETAIL') {
                // Detail page - extract full listing
                if (listingCount >= maxListings) return;

                const rawListing = extractListingFromPage($, url);
                const normalizedListing = normalizeListing(rawListing, 'buyrentkenya', currency);
                listings.push(normalizedListing);
                listingCount++;

                log.info(`Scraped listing ${listingCount}/${maxListings}: ${normalizedListing.title || url}`);
            } else {
                // Listing page - find property links
                log.info(`Processing listing page: ${url}`);

                // Find property detail links
                const propertyLinks = [];
                $('a[href*="/property/"], a[href*="/listing/"], .property-card a, .listing-item a').each((i, el) => {
                    const href = $(el).attr('href');
                    if (href && !propertyLinks.includes(href) && listingCount + propertyLinks.length < maxListings) {
                        const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
                        propertyLinks.push(fullUrl);
                    }
                });

                // Enqueue property detail pages
                for (const link of propertyLinks) {
                    await crawler.addRequests([{ url: link, label: 'DETAIL' }]);
                }

                // Handle pagination if needed
                if (listingCount + propertyLinks.length < maxListings) {
                    await enqueueLinks({
                        selector: 'a.pagination-next, a[rel="next"], .pagination a:contains("Next")',
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
    createCrawler: createBuyRentKenyaCrawler,
    buildSearchUrl
};
