const {createAddColumnMigration} = require('../../utils');
const {createNonTransactionalMigration} = require('../../utils');

module.exports = createNonTransactionalMigration(
    async function up(knex) {
        await knex('settings')
            .whereIn('key', [
                'stripe_secondary_secret_key',
                'stripe_secondary_publishable_key',
                'stripe_secondary_connect_secret_key',
                'stripe_secondary_connect_publishable_key',
                'stripe_secondary_connect_livemode',
                'stripe_secondary_connect_display_name',
                'stripe_secondary_connect_account_id'
            ])
            .del();

        await knex('settings')
            .insert([
                {
                    key: 'stripe_secondary_secret_key',
                    value: null,
                    type: 'string',
                    created_at: knex.raw('NOW()'),
                    created_by: 1,
                    updated_at: knex.raw('NOW()'),
                    updated_by: 1
                },
                {
                    key: 'stripe_secondary_publishable_key',
                    value: null,
                    type: 'string',
                    created_at: knex.raw('NOW()'),
                    created_by: 1,
                    updated_at: knex.raw('NOW()'),
                    updated_by: 1
                },
                {
                    key: 'stripe_secondary_connect_secret_key',
                    value: null,
                    type: 'string',
                    created_at: knex.raw('NOW()'),
                    created_by: 1,
                    updated_at: knex.raw('NOW()'),
                    updated_by: 1
                },
                {
                    key: 'stripe_secondary_connect_publishable_key',
                    value: null,
                    type: 'string',
                    created_at: knex.raw('NOW()'),
                    created_by: 1,
                    updated_at: knex.raw('NOW()'),
                    updated_by: 1
                },
                {
                    key: 'stripe_secondary_connect_livemode',
                    value: null,
                    type: 'boolean',
                    created_at: knex.raw('NOW()'),
                    created_by: 1,
                    updated_at: knex.raw('NOW()'),
                    updated_by: 1
                },
                {
                    key: 'stripe_secondary_connect_display_name',
                    value: null,
                    type: 'string',
                    created_at: knex.raw('NOW()'),
                    created_by: 1,
                    updated_at: knex.raw('NOW()'),
                    updated_by: 1
                },
                {
                    key: 'stripe_secondary_connect_account_id',
                    value: null,
                    type: 'string',
                    created_at: knex.raw('NOW()'),
                    created_by: 1,
                    updated_at: knex.raw('NOW()'),
                    updated_by: 1
                }
            ]);
    },

    async function down(knex) {
        await knex('settings')
            .whereIn('key', [
                'stripe_secondary_secret_key',
                'stripe_secondary_publishable_key',
                'stripe_secondary_connect_secret_key',
                'stripe_secondary_connect_publishable_key',
                'stripe_secondary_connect_livemode',
                'stripe_secondary_connect_display_name',
                'stripe_secondary_connect_account_id'
            ])
            .del();
    }
);

