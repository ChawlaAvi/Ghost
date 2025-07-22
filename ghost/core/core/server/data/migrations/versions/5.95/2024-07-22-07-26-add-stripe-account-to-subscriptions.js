const {addColumn, dropColumn} = require('../../utils');

module.exports = addColumn('members_stripe_customers_subscriptions', 'stripe_account', {
    type: 'string',
    maxlength: 50,
    nullable: true,
    defaultTo: 'primary'
});

module.exports.down = dropColumn('members_stripe_customers_subscriptions', 'stripe_account');

