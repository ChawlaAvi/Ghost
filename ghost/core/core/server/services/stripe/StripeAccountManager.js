const StripeAPI = require('./StripeAPI');
const logging = require('@tryghost/logging');
const errors = require('@tryghost/errors');

/**
 * Manages multiple Stripe accounts (primary and secondary) with fallback logic
 */
class StripeAccountManager {
    constructor({settingsHelpers, labs}) {
        this.settingsHelpers = settingsHelpers;
        this.labs = labs;
        this.primaryAPI = null;
        this.secondaryAPI = null;
        this._configured = false;
    }

    /**
     * Configure the Stripe account manager with current settings
     * @param {Object} config - Configuration object
     */
    async configure(config) {
        try {
            // Clear existing configurations
            this.primaryAPI = null;
            this.secondaryAPI = null;
            this._configured = false;

            if (this.settingsHelpers.isDualStripeAccountsEnabled()) {
                await this._configureDualAccounts(config);
            } else {
                await this._configureLegacyAccount(config);
            }

            this._configured = true;
        } catch (error) {
            logging.error('Failed to configure Stripe Account Manager:', error);
            throw error;
        }
    }

    /**
     * Configure dual Stripe accounts
     * @private
     */
    async _configureDualAccounts(config) {
        const primaryKeys = this.settingsHelpers.getPrimaryStripeKeys();
        const secondaryKeys = this.settingsHelpers.getSecondaryStripeKeys();

        if (primaryKeys) {
            this.primaryAPI = new StripeAPI({labs: this.labs});
            this.primaryAPI.configure({
                ...config,
                secretKey: primaryKeys.secretKey,
                publicKey: primaryKeys.publicKey
            });
            logging.info('Primary Stripe account configured');
        }

        if (secondaryKeys) {
            this.secondaryAPI = new StripeAPI({labs: this.labs});
            this.secondaryAPI.configure({
                ...config,
                secretKey: secondaryKeys.secretKey,
                publicKey: secondaryKeys.publicKey
            });
            logging.info('Secondary Stripe account configured');
        }

        if (!primaryKeys && !secondaryKeys) {
            throw new errors.IncorrectUsageError({
                message: 'Dual accounts enabled but no Stripe keys configured'
            });
        }
    }

    /**
     * Configure legacy single account for backward compatibility
     * @private
     */
    async _configureLegacyAccount(config) {
        if (config.secretKey && config.publicKey) {
            this.primaryAPI = new StripeAPI({labs: this.labs});
            this.primaryAPI.configure(config);
            logging.info('Legacy Stripe account configured as primary');
        }
    }

    /**
     * Get the primary Stripe API instance
     * @returns {StripeAPI|null}
     */
    getPrimaryAPI() {
        return this.primaryAPI;
    }

    /**
     * Get the secondary Stripe API instance
     * @returns {StripeAPI|null}
     */
    getSecondaryAPI() {
        return this.secondaryAPI;
    }

    /**
     * Get all configured Stripe API instances
     * @returns {Array<{account: string, api: StripeAPI}>}
     */
    getAllAPIs() {
        const apis = [];
        
        if (this.primaryAPI) {
            apis.push({
                account: 'primary',
                api: this.primaryAPI
            });
        }

        if (this.secondaryAPI) {
            apis.push({
                account: 'secondary',
                api: this.secondaryAPI
            });
        }

        return apis;
    }

    /**
     * Check if the manager is configured
     * @returns {boolean}
     */
    get configured() {
        return this._configured && (this.primaryAPI !== null || this.secondaryAPI !== null);
    }

    /**
     * Get customer with fallback logic (primary first, then secondary)
     * @param {string} customerId - Stripe customer ID
     * @returns {Promise<{customer: Object, account: string}|null>}
     */
    async getCustomerWithFallback(customerId) {
        // Try primary account first
        if (this.primaryAPI && this.primaryAPI.configured) {
            try {
                const customer = await this.primaryAPI.getCustomer(customerId);
                if (customer) {
                    return {
                        customer,
                        account: 'primary'
                    };
                }
            } catch (error) {
                logging.warn(`Failed to get customer ${customerId} from primary account:`, error.message);
            }
        }

        // Try secondary account if primary failed
        if (this.secondaryAPI && this.secondaryAPI.configured) {
            try {
                const customer = await this.secondaryAPI.getCustomer(customerId);
                if (customer) {
                    return {
                        customer,
                        account: 'secondary'
                    };
                }
            } catch (error) {
                logging.warn(`Failed to get customer ${customerId} from secondary account:`, error.message);
            }
        }

        return null;
    }

    /**
     * Get subscription with fallback logic (primary first, then secondary)
     * @param {string} subscriptionId - Stripe subscription ID
     * @returns {Promise<{subscription: Object, account: string}|null>}
     */
    async getSubscriptionWithFallback(subscriptionId) {
        // Try primary account first
        if (this.primaryAPI && this.primaryAPI.configured) {
            try {
                const subscription = await this.primaryAPI.getSubscription(subscriptionId);
                if (subscription) {
                    return {
                        subscription,
                        account: 'primary'
                    };
                }
            } catch (error) {
                logging.warn(`Failed to get subscription ${subscriptionId} from primary account:`, error.message);
            }
        }

        // Try secondary account if primary failed
        if (this.secondaryAPI && this.secondaryAPI.configured) {
            try {
                const subscription = await this.secondaryAPI.getSubscription(subscriptionId);
                if (subscription) {
                    return {
                        subscription,
                        account: 'secondary'
                    };
                }
            } catch (error) {
                logging.warn(`Failed to get subscription ${subscriptionId} from secondary account:`, error.message);
            }
        }

        return null;
    }

    /**
     * Cancel subscription with fallback logic
     * @param {string} subscriptionId - Stripe subscription ID
     * @returns {Promise<{subscription: Object, account: string}|null>}
     */
    async cancelSubscriptionWithFallback(subscriptionId) {
        // First, find which account has the subscription
        const subscriptionResult = await this.getSubscriptionWithFallback(subscriptionId);
        
        if (!subscriptionResult) {
            throw new errors.NotFoundError({
                message: `Subscription ${subscriptionId} not found in any Stripe account`
            });
        }

        const {account} = subscriptionResult;
        const api = account === 'primary' ? this.primaryAPI : this.secondaryAPI;

        try {
            const canceledSubscription = await api.cancelSubscription(subscriptionId);
            return {
                subscription: canceledSubscription,
                account
            };
        } catch (error) {
            logging.error(`Failed to cancel subscription ${subscriptionId} in ${account} account:`, error);
            throw error;
        }
    }



    /**
     * Create a checkout session (always uses primary account)
     * @param {Object} options - Checkout session options
     * @returns {Promise<Object>}
     */
    async createCheckoutSession(options) {
        if (!this.primaryAPI || !this.primaryAPI.configured) {
            throw new errors.IncorrectUsageError({
                message: 'Primary Stripe account must be configured to create checkout sessions'
            });
        }

        return await this.primaryAPI.createCheckoutSession(options);
    }

    /**
     * Disconnect all Stripe accounts
     */
    async disconnect() {
        this.primaryAPI = null;
        this.secondaryAPI = null;
        this._configured = false;
        logging.info('All Stripe accounts disconnected');
    }
}

module.exports = StripeAccountManager;
