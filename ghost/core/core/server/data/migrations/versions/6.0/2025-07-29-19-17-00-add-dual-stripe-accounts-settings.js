const {combineTransactionalMigrations, addSetting} = require('../../utils');

module.exports = combineTransactionalMigrations(
    // Primary account settings
    addSetting({
        key: 'stripe_primary_connect_publishable_key',
        value: null,
        type: 'string',
        group: 'members'
    }),
    addSetting({
        key: 'stripe_primary_connect_secret_key',
        value: null,
        type: 'string',
        group: 'members'
    }),
    addSetting({
        key: 'stripe_primary_connect_livemode',
        value: null,
        type: 'boolean',
        group: 'members'
    }),
    addSetting({
        key: 'stripe_primary_connect_display_name',
        value: null,
        type: 'string',
        group: 'members'
    }),
    addSetting({
        key: 'stripe_primary_connect_account_id',
        value: null,
        type: 'string',
        group: 'members'
    }),
    addSetting({
        key: 'stripe_primary_secret_key',
        value: null,
        type: 'string',
        group: 'members'
    }),
    addSetting({
        key: 'stripe_primary_publishable_key',
        value: null,
        type: 'string',
        group: 'members'
    }),
    
    // Secondary account settings
    addSetting({
        key: 'stripe_secondary_connect_publishable_key',
        value: null,
        type: 'string',
        group: 'members'
    }),
    addSetting({
        key: 'stripe_secondary_connect_secret_key',
        value: null,
        type: 'string',
        group: 'members'
    }),
    addSetting({
        key: 'stripe_secondary_connect_livemode',
        value: null,
        type: 'boolean',
        group: 'members'
    }),
    addSetting({
        key: 'stripe_secondary_connect_display_name',
        value: null,
        type: 'string',
        group: 'members'
    }),
    addSetting({
        key: 'stripe_secondary_connect_account_id',
        value: null,
        type: 'string',
        group: 'members'
    }),
    addSetting({
        key: 'stripe_secondary_secret_key',
        value: null,
        type: 'string',
        group: 'members'
    }),
    addSetting({
        key: 'stripe_secondary_publishable_key',
        value: null,
        type: 'string',
        group: 'members'
    }),
    
    // Feature flag
    addSetting({
        key: 'stripe_dual_accounts_enabled',
        value: 'false',
        type: 'boolean',
        group: 'members'
    })
);

