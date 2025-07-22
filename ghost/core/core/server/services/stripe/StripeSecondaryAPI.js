const StripeAPI = require('./StripeAPI');

/**
 * @typedef {import('./StripeAPI').StripeAPIConfig} StripeAPIConfig
 */

/**
 * StripeSecondaryAPI extends the StripeAPI class to provide a secondary Stripe account
 * for Ghost to use. This allows for checking subscriptions in multiple Stripe accounts.
 */
class StripeSecondaryAPI extends StripeAPI {
    /**
     * Creates an instance of StripeSecondaryAPI
     * @param {object} deps
     * @param {object} deps.labs - Labs service
     */
    constructor({labs}) {
        super({labs});
        this.isSecondary = true;
    }

    /**
     * Returns whether this is a secondary Stripe API instance
     * @returns {boolean}
     */
    isSecondaryAccount() {
        return this.isSecondary;
    }
}

module.exports = StripeSecondaryAPI;

