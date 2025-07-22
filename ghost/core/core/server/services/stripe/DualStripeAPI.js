const StripeAPI = require('./StripeAPI');
const logging = require('@tryghost/logging');
const debug = require('@tryghost/debug')('stripe:dual');

/**
 * DualStripeAPI wraps two StripeAPI instances (primary and secondary) and provides
 * intelligent fallback logic for subscription operations.
 * 
 * Read operations (like getSubscription) try primary first, then secondary.
 * Write operations (like creating/canceling subscriptions) use the appropriate account
 * based on where the subscription exists.
 */
module.exports = class DualStripeAPI {
    /**
     * @param {object} deps
     * @param {object} deps.labs
     */
    constructor(deps) {
        this.labs = deps.labs;
        this._primaryAPI = new StripeAPI(deps);
        this._secondaryAPI = new StripeAPI(deps);
        this._configured = false;
        this._primaryConfigured = false;
        this._secondaryConfigured = false;
    }

    /**
     * Configure both primary and secondary Stripe APIs
     * @param {object} config
     * @param {object} config.primary - Primary account configuration
     * @param {object} config.secondary - Secondary account configuration (optional)
     */
    configure(config) {
        debug('Configuring dual Stripe API');
        
        if (config.primary) {
            debug('Configuring primary Stripe API');
            this._primaryAPI.configure(config.primary);
            this._primaryConfigured = true;
        } else {
            debug('No primary Stripe configuration provided');
            this._primaryConfigured = false;
        }

        if (config.secondary) {
            debug('Configuring secondary Stripe API');
            this._secondaryAPI.configure(config.secondary);
            this._secondaryConfigured = true;
        } else {
            debug('No secondary Stripe configuration provided');
            this._secondaryConfigured = false;
        }

        this._configured = this._primaryConfigured || this._secondaryConfigured;
        
        if (!this._configured) {
            debug('No Stripe configuration provided for either account');
        }
    }

    /**
     * Returns true if at least one Stripe API is configured
     */
    get configured() {
        return this._configured;
    }

    /**
     * Returns true if primary API is configured
     */
    get primaryConfigured() {
        return this._primaryConfigured;
    }

    /**
     * Returns true if secondary API is configured
     */
    get secondaryConfigured() {
        return this._secondaryConfigured;
    }

    /**
     * Get the primary API instance
     */
    get primaryAPI() {
        return this._primaryAPI;
    }

    /**
     * Get the secondary API instance
     */
    get secondaryAPI() {
        return this._secondaryAPI;
    }

    /**
     * Returns true if this package is running in a test environment
     */
    get testEnv() {
        return this._primaryAPI.testEnv;
    }

    /**
     * Get subscription from either primary or secondary account
     * Tries primary first, then falls back to secondary
     * 
     * @param {string} id - Subscription ID
     * @param {object} options - Stripe options
     * @returns {Promise<{subscription: object, account: 'primary'|'secondary'}>}
     */
    async getSubscription(id, options = {}) {
        debug(`getSubscription(${id}) - trying dual account lookup`);

        // Try primary account first
        if (this._primaryConfigured) {
            try {
                debug(`getSubscription(${id}) - trying primary account`);
                const subscription = await this._primaryAPI.getSubscription(id, options);
                debug(`getSubscription(${id}) - found in primary account`);
                return {
                    subscription,
                    account: 'primary'
                };
            } catch (err) {
                debug(`getSubscription(${id}) - not found in primary account: ${err.message}`);
                // Continue to try secondary account
            }
        }

        // Try secondary account if primary failed
        if (this._secondaryConfigured) {
            try {
                debug(`getSubscription(${id}) - trying secondary account`);
                const subscription = await this._secondaryAPI.getSubscription(id, options);
                debug(`getSubscription(${id}) - found in secondary account`);
                return {
                    subscription,
                    account: 'secondary'
                };
            } catch (err) {
                debug(`getSubscription(${id}) - not found in secondary account: ${err.message}`);
                // Both accounts failed, throw the last error
                throw err;
            }
        }

        // If we get here, no accounts are configured or both failed
        throw new Error(`Subscription ${id} not found in any configured Stripe account`);
    }

    /**
     * Cancel subscription in the appropriate account
     * First determines which account the subscription belongs to, then cancels it there
     * 
     * @param {string} id - Subscription ID
     * @returns {Promise<object>}
     */
    async cancelSubscription(id) {
        debug(`cancelSubscription(${id}) - determining account`);

        try {
            // First, find which account the subscription belongs to
            const {subscription, account} = await this.getSubscription(id);
            
            debug(`cancelSubscription(${id}) - found in ${account} account, canceling`);
            
            if (account === 'primary') {
                return await this._primaryAPI.cancelSubscription(id);
            } else {
                return await this._secondaryAPI.cancelSubscription(id);
            }
        } catch (err) {
            debug(`cancelSubscription(${id}) - failed: ${err.message}`);
            throw err;
        }
    }

    /**
     * Update subscription in the appropriate account
     * 
     * @param {string} id - Subscription ID
     * @param {object} data - Update data
     * @returns {Promise<object>}
     */
    async updateSubscription(id, data) {
        debug(`updateSubscription(${id}) - determining account`);

        try {
            // First, find which account the subscription belongs to
            const {subscription, account} = await this.getSubscription(id);
            
            debug(`updateSubscription(${id}) - found in ${account} account, updating`);
            
            if (account === 'primary') {
                return await this._primaryAPI.updateSubscription(id, data);
            } else {
                return await this._secondaryAPI.updateSubscription(id, data);
            }
        } catch (err) {
            debug(`updateSubscription(${id}) - failed: ${err.message}`);
            throw err;
        }
    }

    /**
     * Get customer from either primary or secondary account
     * Tries primary first, then falls back to secondary
     * 
     * @param {string} id - Customer ID
     * @param {object} options - Stripe options
     * @returns {Promise<{customer: object, account: 'primary'|'secondary'}>}
     */
    async getCustomer(id, options = {}) {
        debug(`getCustomer(${id}) - trying dual account lookup`);

        // Try primary account first
        if (this._primaryConfigured) {
            try {
                debug(`getCustomer(${id}) - trying primary account`);
                const customer = await this._primaryAPI.getCustomer(id, options);
                debug(`getCustomer(${id}) - found in primary account`);
                return {
                    customer,
                    account: 'primary'
                };
            } catch (err) {
                debug(`getCustomer(${id}) - not found in primary account: ${err.message}`);
                // Continue to try secondary account
            }
        }

        // Try secondary account if primary failed
        if (this._secondaryConfigured) {
            try {
                debug(`getCustomer(${id}) - trying secondary account`);
                const customer = await this._secondaryAPI.getCustomer(id, options);
                debug(`getCustomer(${id}) - found in secondary account`);
                return {
                    customer,
                    account: 'secondary'
                };
            } catch (err) {
                debug(`getCustomer(${id}) - not found in secondary account: ${err.message}`);
                throw err;
            }
        }

        throw new Error(`Customer ${id} not found in any configured Stripe account`);
    }

    // Delegate all other methods to primary API (for new operations)
    // These methods should only be used for creating new resources, which always go to primary

    async createCustomer(data) {
        if (!this._primaryConfigured) {
            throw new Error('Primary Stripe account must be configured for creating new customers');
        }
        debug('createCustomer - using primary account');
        return await this._primaryAPI.createCustomer(data);
    }

    async createPrice(data) {
        if (!this._primaryConfigured) {
            throw new Error('Primary Stripe account must be configured for creating new prices');
        }
        debug('createPrice - using primary account');
        return await this._primaryAPI.createPrice(data);
    }

    async createProduct(data) {
        if (!this._primaryConfigured) {
            throw new Error('Primary Stripe account must be configured for creating new products');
        }
        debug('createProduct - using primary account');
        return await this._primaryAPI.createProduct(data);
    }

    async createCheckoutSession(data) {
        if (!this._primaryConfigured) {
            throw new Error('Primary Stripe account must be configured for creating checkout sessions');
        }
        debug('createCheckoutSession - using primary account');
        return await this._primaryAPI.createCheckoutSession(data);
    }

    async createCheckoutSetupSession(data) {
        if (!this._primaryConfigured) {
            throw new Error('Primary Stripe account must be configured for creating setup sessions');
        }
        debug('createCheckoutSetupSession - using primary account');
        return await this._primaryAPI.createCheckoutSetupSession(data);
    }

    async createCoupon(data) {
        if (!this._primaryConfigured) {
            throw new Error('Primary Stripe account must be configured for creating coupons');
        }
        debug('createCoupon - using primary account');
        return await this._primaryAPI.createCoupon(data);
    }

    // Webhook-related methods - need to handle both accounts
    async createWebhookEndpoint(data) {
        const results = {};
        
        if (this._primaryConfigured) {
            debug('createWebhookEndpoint - creating for primary account');
            results.primary = await this._primaryAPI.createWebhookEndpoint(data);
        }
        
        if (this._secondaryConfigured) {
            debug('createWebhookEndpoint - creating for secondary account');
            results.secondary = await this._secondaryAPI.createWebhookEndpoint(data);
        }
        
        return results;
    }

    async deleteWebhookEndpoint(id, account = null) {
        if (account === 'primary' && this._primaryConfigured) {
            debug('deleteWebhookEndpoint - deleting from primary account');
            return await this._primaryAPI.deleteWebhookEndpoint(id);
        } else if (account === 'secondary' && this._secondaryConfigured) {
            debug('deleteWebhookEndpoint - deleting from secondary account');
            return await this._secondaryAPI.deleteWebhookEndpoint(id);
        } else {
            // Try to delete from both accounts if no specific account is specified
            const results = {};
            
            if (this._primaryConfigured) {
                try {
                    debug('deleteWebhookEndpoint - trying to delete from primary account');
                    results.primary = await this._primaryAPI.deleteWebhookEndpoint(id);
                } catch (err) {
                    debug(`deleteWebhookEndpoint - failed to delete from primary: ${err.message}`);
                }
            }
            
            if (this._secondaryConfigured) {
                try {
                    debug('deleteWebhookEndpoint - trying to delete from secondary account');
                    results.secondary = await this._secondaryAPI.deleteWebhookEndpoint(id);
                } catch (err) {
                    debug(`deleteWebhookEndpoint - failed to delete from secondary: ${err.message}`);
                }
            }
            
            return results;
        }
    }

    // Pass-through methods that should work with primary account by default
    // but can be overridden to work with specific accounts

    async getPrice(id, account = 'primary') {
        const api = account === 'secondary' ? this._secondaryAPI : this._primaryAPI;
        if (!api.configured) {
            throw new Error(`${account} Stripe account is not configured`);
        }
        return await api.getPrice(id);
    }

    async getProduct(id, account = 'primary') {
        const api = account === 'secondary' ? this._secondaryAPI : this._primaryAPI;
        if (!api.configured) {
            throw new Error(`${account} Stripe account is not configured`);
        }
        return await api.getProduct(id);
    }

    async listPrices(options = {}, account = 'primary') {
        const api = account === 'secondary' ? this._secondaryAPI : this._primaryAPI;
        if (!api.configured) {
            throw new Error(`${account} Stripe account is not configured`);
        }
        return await api.listPrices(options);
    }

    async listProducts(options = {}, account = 'primary') {
        const api = account === 'secondary' ? this._secondaryAPI : this._primaryAPI;
        if (!api.configured) {
            throw new Error(`${account} Stripe account is not configured`);
        }
        return await api.listProducts(options);
    }

    // Webhook parsing methods
    parseWebhook(body, signature, secret) {
        if (!this._primaryConfigured) {
            throw new Error('Primary Stripe account is not configured');
        }
        return this._primaryAPI.parseWebhook(body, signature, secret);
    }

    parseSecondaryWebhook(body, signature, secret) {
        if (!this._secondaryConfigured) {
            throw new Error('Secondary Stripe account is not configured');
        }
        return this._secondaryAPI.parseWebhook(body, signature, secret);
    }
};
