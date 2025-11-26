/**
 * Main entry point for Kenya Real Estate Scraper Actor
 * Scrapes real estate listings from BuyRentKenya, Jiji, and other EAC classifieds
 */

import { Actor } from 'apify';
import { createBuyRentKenyaCrawler } from './buyrentkenya.js';
import { createJijiCrawler } from './jiji.js';

// Mapping of source names to crawler factories
const CRAWLERS = {
    buyrentkenya: createBuyRentKenyaCrawler,
    jiji: createJijiCrawler
};

await Actor.init();

try {
    // Get input configuration
    const input = await Actor.getInput() || {};

    const {
        sources = ['buyrentkenya', 'jiji'],
        listingType = 'all',
        propertyType = 'all',
        location = '',
        maxListings = 100,
        currency = 'KES',
        proxyConfiguration
    } = input;

    console.log('Starting Kenya Real Estate Scraper');
    console.log('Configuration:', JSON.stringify({
        sources,
        listingType,
        propertyType,
        location,
        maxListings,
        currency
    }, null, 2));

    // Setup proxy if configured
    let proxyConfig = null;
    if (proxyConfiguration) {
        proxyConfig = await Actor.createProxyConfiguration(proxyConfiguration);
    }

    const allListings = [];

    // Process each source
    for (const source of sources) {
        const crawlerFactory = CRAWLERS[source.toLowerCase()];

        if (!crawlerFactory) {
            console.warn(`Unknown source: ${source}. Skipping.`);
            continue;
        }

        console.log(`\n--- Starting scrape for ${source} ---`);

        const crawlerInstance = crawlerFactory({
            listingType,
            propertyType,
            location,
            maxListings: Math.ceil(maxListings / sources.length), // Split quota among sources
            currency,
            proxyConfiguration: proxyConfig
        });

        const startUrl = crawlerInstance.buildSearchUrl({
            listingType,
            propertyType,
            location
        });

        console.log(`Starting URL: ${startUrl}`);

        await crawlerInstance.crawler.run([{ url: startUrl, label: 'LIST' }]);

        const sourceListings = crawlerInstance.getListings();
        console.log(`Scraped ${sourceListings.length} listings from ${source}`);

        allListings.push(...sourceListings);
    }

    // Save results to dataset
    console.log(`\nTotal listings scraped: ${allListings.length}`);

    if (allListings.length > 0) {
        await Actor.pushData(allListings);
        console.log('Listings saved to dataset.');
    }

    // Save summary to key-value store
    await Actor.setValue('OUTPUT', {
        success: true,
        totalListings: allListings.length,
        sources: sources,
        scrapedAt: new Date().toISOString(),
        configuration: {
            listingType,
            propertyType,
            location,
            maxListings,
            currency
        }
    });

} catch (error) {
    console.error('Scraper failed:', error);
    await Actor.setValue('OUTPUT', {
        success: false,
        error: error.message
    });
    throw error;
} finally {
    await Actor.exit();
}
