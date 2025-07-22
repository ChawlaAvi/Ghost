const _ = require('lodash');
const errors = require('@tryghost/errors');
const logging = require('@tryghost/logging');
const tpl = require('@tryghost/tpl');
const DomainEvents = require('@tryghost/domain-events');
const {SubscriptionActivatedEvent, MemberCreatedEvent, SubscriptionCreatedEvent, MemberSubscribeEvent, SubscriptionCancelledEvent, OfferRedemptionEvent} = require('../../../../../shared/events');
const ObjectId = require('bson-objectid').default;
const {NotFoundError} = require('@tryghost/errors');
const validator = require('@tryghost/validator');
const crypto = require('crypto');

const messages = {
    noStripeConnection: 'Cannot {action} without a Stripe Connection',
    moreThanOneProduct: 'A member cannot have more than one Product',
    addProductWithActiveSubscription: 'Cannot add comped Products to a Member with active Subscriptions',
    deleteProductWithActiveSubscription: 'Cannot delete a non-comped Product from a Member, because it has an active Subscription for the same product',
    memberNotFound: 'Could not find Member {id}',
    subscriptionNotFound: 'Could not find Subscription {id}',
    productNotFound: 'Could not find Product {id}',
    bulkActionRequiresFilter: 'Cannot perform {action} without a filter or all=true',
    tierArchived: 'Cannot use archived Tiers',
    invalidEmail: 'Invalid Email'
};

const SUBSCRIPTION_STATUS_TRIALING = 'trialing';

/**
 * @typedef {object} ITokenService
 * @prop {(token: string) => Promise<import('jsonwebtoken').JwtPayload>} decodeToken
 */

module.exports = class MemberRepository {
    /**
     * @param {object} deps
     * @param {any} deps.Member
     * @param {any} deps.MemberNewsletter
     * @param {any} deps.MemberCancelEvent
     * @param {any} deps.MemberSubscribeEventModel
     * @param {any} deps.MemberEmailChangeEvent
     * @param {any} deps.MemberPaidSubscriptionEvent
     * @param {any} deps.MemberStatusEvent
     * @param {any} deps.MemberProductEvent
     * @param {any} deps.StripeCustomer
     * @param {any} deps.StripeCustomerSubscription
     * @param {any} deps.OfferRedemption
     * @param {import('../../services/stripe-api')} deps.stripeAPIService
     * @param {any} deps.labsService
     * @param {any} deps.productRepository
     * @param {any} deps.offerRepository
     * @param {ITokenService} deps.tokenService
     * @param {any} deps.newslettersService
     */
    constructor({
        Member,
        MemberNewsletter,
        MemberCancelEvent,
        MemberSubscribeEventModel,
        MemberEmailChangeEvent,
        MemberPaidSubscriptionEvent,
        MemberStatusEvent,
        MemberProductEvent,
        StripeCustomer,
        StripeCustomerSubscription,
        OfferRedemption,
        stripeAPIService,
        labsService,
        productRepository,
        offerRepository,
        tokenService,
        newslettersService
    }) {
        this._Member = Member;
        this._MemberNewsletter = MemberNewsletter;
        this._MemberCancelEvent = MemberCancelEvent;
        this._MemberSubscribeEvent = MemberSubscribeEventModel;
        this._MemberEmailChangeEvent = MemberEmailChangeEvent;
        this._MemberPaidSubscriptionEvent = MemberPaidSubscriptionEvent;
        this._MemberStatusEvent = MemberStatusEvent;
        this._MemberProductEvent = MemberProductEvent;
        this._OfferRedemption = OfferRedemption;
        this._StripeCustomer = StripeCustomer;
        this._StripeCustomerSubscription = StripeCustomerSubscription;
        this._stripeAPIService = stripeAPIService;
        this._productRepository = productRepository;
        this._offerRepository = offerRepository;
        this.tokenService = tokenService;
        this._newslettersService = newslettersService;
        this._labsService = labsService;

        DomainEvents.subscribe(OfferRedemptionEvent, async function (event) {
            if (!event.data.offerId) {
                return;
            }

            // To be extra safe, check if the redemption already exists before adding it
            const existingRedemption = await OfferRedemption.findOne({
                member_id: event.data.memberId,
                subscription_id: event.data.subscriptionId,
                offer_id: event.data.offerId
            });

            if (existingRedemption) {
                return;
            }

            await OfferRedemption.add({
                member_id: event.data.memberId,
                subscription_id: event.data.subscriptionId,
                offer_id: event.data.offerId
            });
        });
    }

    // ... existing methods ...

    async getSubscriptionByStripeID(id, options) {
        const subscription = await this._StripeCustomerSubscription.findOne({
            subscription_id: id
        }, options);

        return subscription;
    }

    /**
     * Get a subscription by ID, checking both primary and secondary Stripe accounts
     * 
     * @param {Object} data
     * @param {String} data.email - member email
     * @param {Object} data.subscription
     * @param {String} data.subscription.subscription_id - Stripe subscription ID
     * @param {*} options
     * @returns {Promise<Object>} - The subscription object
     */
    async getSubscription(data, options) {
        if (!this._stripeAPIService.configured) {
            throw new errors.BadRequestError({message: tpl(messages.noStripeConnection, {action: 'get Stripe Subscription'})});
        }

        const member = await this._Member.findOne({
            email: data.email
        });

        // Check for subscription in primary Stripe account
        const subscription = await member.related('stripeSubscriptions').query({
            where: {
                subscription_id: data.subscription.subscription_id
            }
        }).fetchOne(options);

        if (!subscription) {
            throw new errors.NotFoundError({message: tpl(messages.subscriptionNotFound, {id: data.subscription.subscription_id})});
        }

        return subscription.toJSON();
    }

    /**
     * Check if a member has an active subscription in either primary or secondary Stripe account
     * 
     * @param {Object} member - The member object
     * @param {Object} options - Options
     * @returns {Promise<Object|null>} - The subscription object or null
     */
    async getActiveSubscription(member, options) {
        // First check primary Stripe account
        const subscriptions = await member.related('stripeSubscriptions').fetch(options);
        
        if (!subscriptions || subscriptions.length === 0) {
            return null;
        }

        // Find active subscriptions
        const activeSubscription = subscriptions.find(subscription => {
            return ['active', 'trialing', 'past_due'].includes(subscription.get('status'));
        });

        return activeSubscription ? activeSubscription.toJSON() : null;
    }

    // ... rest of the file ...

    async cancelSubscription(data, options) {
        const sharedOptions = {
            transacting: options ? options.transacting : null
        };
        if (!this._stripeAPIService.configured) {
            throw new errors.BadRequestError({message: tpl(messages.noStripeConnection, {action: 'update Stripe Subscription'})});
        }

        let findQuery = null;
        if (data.id) {
            findQuery = {id: data.id};
        } else if (data.email) {
            findQuery = {email: data.email};
        }

        if (!findQuery) {
            throw new errors.NotFoundError({message: tpl(messages.subscriptionNotFound)});
        }

        const member = await this._Member.findOne(findQuery);

        const subscription = await member.related('stripeSubscriptions').query({
            where: {
                subscription_id: data.subscription.subscription_id
            }
        }).fetchOne(options);

        if (!subscription) {
            throw new errors.NotFoundError({message: tpl(messages.subscriptionNotFound, {id: data.subscription.subscription_id})});
        }

        // Get the Stripe API instance based on the subscription's source
        const stripeAPI = this._stripeAPIService;

        const subscriptionId = data.subscription.subscription_id;
        const subscriptionData = await stripeAPI.getSubscription(subscriptionId);

        const updatedSubscription = await stripeAPI.cancelSubscription(subscriptionId);

        await this._StripeCustomerSubscription.edit({
            status: updatedSubscription.status,
            cancel_at_period_end: updatedSubscription.cancel_at_period_end,
            cancellation_reason: data.cancellationReason || null,
            current_period_end: new Date(updatedSubscription.current_period_end * 1000)
        }, {
            id: subscription.id,
            ...sharedOptions
        });

        if (updatedSubscription.status === 'canceled') {
            DomainEvents.dispatch(SubscriptionCancelledEvent.create({
                source: 'stripe',
                memberId: member.id,
                subscriptionId: updatedSubscription.id,
                tierId: subscription.get('tier_id'),
                type: subscriptionData.items?.data[0]?.price?.recurring?.interval || null,
                fromPlan: subscriptionData.items?.data[0]?.price?.id || null,
                cancelAtPeriodEnd: false,
                cancellationReason: data.cancellationReason || null
            }));
        }

        return subscription;
    }

    // ... rest of the file ...
};

