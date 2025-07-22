const logging = require('@tryghost/logging');
const tpl = require('@tryghost/tpl');
const labs = require('../../../shared/labs');

const messages = {
    remoteWebhooksInDevelopment: 'Cannot use remote webhooks in development. See https://ghost.org/docs/webhooks/#stripe-webhooks for developing with Stripe.'
};

// @TODO Refactor to a class w/ constructor

/**
 * @typedef {object} StripeURLConfig
 * @prop {string} checkoutSessionSuccessUrl
 * @prop {string} checkoutSessionCancelUrl
 * @prop {string} checkoutSetupSessionSuccessUrl
 * @prop {string} checkoutSetupSessionCancelUrl
 */

module.exports = {
    getConfig({config, urlUtils, settingsHelpers}) {
        /**
         * @returns {StripeURLConfig}
         */
        function getStripeUrlConfig() {
            const siteUrl = urlUtils.getSiteUrl();

            const checkoutSuccessUrl = new URL(siteUrl);
            checkoutSuccessUrl.searchParams.set('stripe', 'success');
            const checkoutCancelUrl = new URL(siteUrl);
            checkoutCancelUrl.searchParams.set('stripe', 'cancel');

            const billingSuccessUrl = new URL(siteUrl);
            billingSuccessUrl.searchParams.set('stripe', 'billing-update-success');
            const billingCancelUrl = new URL(siteUrl);
            billingCancelUrl.searchParams.set('stripe', 'billing-update-cancel');

            return {
                checkoutSessionSuccessUrl: checkoutSuccessUrl.href,
                checkoutSessionCancelUrl: checkoutCancelUrl.href,
                checkoutSetupSessionSuccessUrl: billingSuccessUrl.href,
                checkoutSetupSessionCancelUrl: billingCancelUrl.href
            };
        }

        const dualKeys = settingsHelpers.getDualStripeKeys();
        const primaryKeys = dualKeys.primary;
        const secondaryKeys = dualKeys.secondary;
        
        // If no primary keys are configured, fall back to legacy behavior
        if (!primaryKeys) {
            return null;
        }

        const env = config.get('env');
        let webhookSecret = process.env.WEBHOOK_SECRET;
        let secondaryWebhookSecret = process.env.WEBHOOK_SECRET_SECONDARY;

        if (env !== 'production') {
            if (!webhookSecret) {
                webhookSecret = 'DEFAULT_WEBHOOK_SECRET';
                logging.warn(tpl(messages.remoteWebhooksInDevelopment));
            }
            if (!secondaryWebhookSecret && secondaryKeys) {
                secondaryWebhookSecret = 'DEFAULT_WEBHOOK_SECRET_SECONDARY';
            }
        }

        const webhookHandlerUrl = new URL('members/webhooks/stripe/', urlUtils.getSiteUrl());
        const secondaryWebhookHandlerUrl = new URL('members/webhooks/stripe/secondary/', urlUtils.getSiteUrl());

        const urls = getStripeUrlConfig();
        const accountNames = settingsHelpers.getStripeAccountNames();

        const primaryConfig = {
            ...primaryKeys,
            ...urls,
            enablePromoCodes: config.get('enableStripePromoCodes'),
            get enableAutomaticTax() {
                return labs.isSet('stripeAutomaticTax');
            },
            webhookSecret: webhookSecret,
            webhookHandlerUrl: webhookHandlerUrl.href,
            accountName: accountNames.primary
        };

        const secondaryConfig = secondaryKeys ? {
            ...secondaryKeys,
            ...urls,
            enablePromoCodes: config.get('enableStripePromoCodes'),
            get enableAutomaticTax() {
                return labs.isSet('stripeAutomaticTax');
            },
            webhookSecret: secondaryWebhookSecret,
            webhookHandlerUrl: secondaryWebhookHandlerUrl.href,
            accountName: accountNames.secondary
        } : null;

        return {
            primary: primaryConfig,
            secondary: secondaryConfig,
            // Legacy support - return primary config at root level for backward compatibility
            ...primaryConfig
        };
    }
};
