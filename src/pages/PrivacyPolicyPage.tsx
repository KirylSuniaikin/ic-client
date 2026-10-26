import React, {useEffect} from 'react';
import {Link as RouterLink} from 'react-router-dom';
import {Box, Container, Divider, Link, Tab, Tabs, Typography} from '@mui/material';
import {SeoHead} from '../shared/components/SeoHead';

// Deliberately NOT wired to i18n. The six shared locale namespaces are byte-identical to
// ic-pizza-mobile's and pinned by a parity test there, so adding keys here would break the
// mobile suite. A legal document also needs a reviewed translation rather than a machine one —
// when the Arabic version is ready, add it as a separate route or a web-only namespace.

const LAST_UPDATED = '26 October 2026';
// Its own date rather than LAST_UPDATED: the two policies change independently, and re-dating the
// customer policy for a rider-only change would tell customers something changed for them.
const COURIER_APP_EFFECTIVE_DATE = '6 October 2026';

const COMPANY_LEGAL_NAME = 'IC PIZZA W.L.L.';
const COMPANY_ADDRESS = 'Bahrain, Hidd, Block 101, Road 114, Building 1284, Shop 0';
const CONTACT_EMAIL = 'andrew@ic-pizza.com';

// Astra Delivery will run the courier app once it is registered as a company. Until then IC Pizza
// runs it and controls the riders' data, and this one sentence is all that changes on that day.
const COURIER_APP_CONTROLLER = `Astra Courier is operated by ${COMPANY_LEGAL_NAME}, ${COMPANY_ADDRESS}, for its delivery service, and ${COMPANY_LEGAL_NAME} ("we", "us") is the controller of the personal data described on this tab.`;

const TAB_ORDER = ['ic-pizza', 'delivery'] as const;
export type PrivacyPolicyTab = (typeof TAB_ORDER)[number];

interface PolicyTabDefinition {
    label: string;
    // Every tab is a URL of its own: Google Play's privacy-policy field needs a link that opens the
    // courier policy directly, not a page a reviewer has to click through.
    path: string;
    heading: string;
    seoTitle: string;
    seoDescription: string;
}

const POLICY_TABS: Record<PrivacyPolicyTab, PolicyTabDefinition> = {
    'ic-pizza': {
        label: 'IC Pizza (website, app, kiosk)',
        path: '/privacy',
        heading: 'Privacy Policy',
        seoTitle: 'Privacy Policy | IC Pizza',
        seoDescription: 'How IC Pizza collects, uses and protects your personal data across our website, mobile app and kiosk terminals.',
    },
    delivery: {
        label: 'Astra Courier (delivery)',
        path: '/privacy/delivery',
        heading: 'Astra Courier Privacy Policy',
        seoTitle: 'Astra Courier Privacy Policy | IC Pizza',
        seoDescription: "How the Astra Courier app used by IC Pizza's delivery riders collects, uses and protects rider data, including background location and delivery photos.",
    },
};

// The App Store asks where a customer deletes their account; this id lets a link land on the steps.
export const DELETE_ACCOUNT_SECTION_ID = 'delete-account';

// Google Play's data-safety form asks for a URL that opens the deletion instructions themselves,
// so the section has an id and a route of its own (/privacy/delivery/delete-data).
export const DELETE_DATA_SECTION_ID = 'delete-data';
const DELETE_DATA_PATH = '/privacy/delivery/delete-data';

function tabElementId(tab: PrivacyPolicyTab): string {
    return `privacy-policy-tab-${tab}`;
}

function Section({title, id, children}: {title: string; id?: string; children: React.ReactNode}): JSX.Element {
    return (
        <Box id={id} sx={{mt: 4, scrollMarginTop: 16}}>
            <Typography variant="h6" component="h2" sx={{fontWeight: 600, mb: 1}}>
                {title}
            </Typography>
            {children}
        </Box>
    );
}

function P({children}: {children: React.ReactNode}): JSX.Element {
    return (
        <Typography variant="body1" sx={{mb: 1.5, lineHeight: 1.7}}>
            {children}
        </Typography>
    );
}

function Bullet({children}: {children: React.ReactNode}): JSX.Element {
    return (
        <Typography component="li" variant="body1" sx={{mb: 0.75, lineHeight: 1.7}}>
            {children}
        </Typography>
    );
}

function IcPizzaPolicy(): JSX.Element {
    return (
        <>
            <Typography variant="body2" color="text.secondary" sx={{mt: 1}}>
                Last updated: {LAST_UPDATED}
            </Typography>

            <Divider sx={{my: 3}}/>

            <P>
                This policy explains what personal data {COMPANY_LEGAL_NAME} (&quot;IC Pizza&quot;,
                &quot;we&quot;) collects when you order from us, why we collect it, who we share it
                with, and how you can ask us to delete it.
            </P>
            <P>
                It covers three products: our website, our customer mobile app, and the
                self-service kiosk terminals in our restaurants. Where a product differs, this is
                stated explicitly.
            </P>

            <Section title="1. Who we are">
                <P>
                    {COMPANY_LEGAL_NAME}, {COMPANY_ADDRESS}. For any question about this policy or
                    about your data, write to{' '}
                    <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>.
                </P>
            </Section>

            <Section title="2. What we collect">
                <P>Depending on how you order, we may collect:</P>
                <Box component="ul" sx={{pl: 3, mt: 0}}>
                    <Bullet>
                        <strong>Phone number</strong> — used to identify your order, to call you
                        when it is ready, and to send you order updates.
                    </Bullet>
                    <Bullet>
                        <strong>Name</strong> — when you choose to give one, so staff can address
                        you at collection.
                    </Bullet>
                    <Bullet>
                        <strong>Order contents</strong> — the items, sizes and modifications you
                        selected, the amount and the branch.
                    </Bullet>
                    <Bullet>
                        <strong>Notes you type with an order</strong> — free text you add for the
                        kitchen (for example &quot;no onions&quot;).
                    </Bullet>
                    <Bullet>
                        <strong>Delivery address</strong> — website and mobile app only, and only
                        when you choose delivery.
                    </Bullet>
                    <Bullet>
                        <strong>Location</strong> — mobile app only, and only if you allow it. While
                        the app is open it reads your device&apos;s location to find the branch
                        nearest to you and to place your delivery address on the map. It does not
                        read your location in the background.
                    </Bullet>
                    <Bullet>
                        <strong>Account data</strong> — website and mobile app only. We verify your
                        phone number with a one-time code and keep a record of your past orders and
                        the delivery addresses you save.
                    </Bullet>
                    <Bullet>
                        <strong>Device and app information</strong> — mobile app and kiosk only:
                        the app version and a push-notification token, so we can send you order
                        updates and tell you when an update is required.
                    </Bullet>
                </Box>
                <P>
                    <strong>Kiosk terminals collect only a phone number, your order contents and
                    any note you type.</strong> They have no user accounts, no login, and no
                    advertising or analytics tracking of any kind.
                </P>
                <P>
                    <strong>We never receive or store your card details.</strong> Card payments are
                    processed by our payment providers on their own equipment and systems — at a
                    kiosk, on the physical card terminal next to it; on the website and in the app,
                    in the payment provider&apos;s own secure card form or through Apple Pay. Card
                    numbers do not pass through our apps or our servers.
                </P>
            </Section>

            <Section title="3. Why we collect it">
                <Box component="ul" sx={{pl: 3, mt: 0}}>
                    <Bullet>To prepare, identify and hand over your order.</Bullet>
                    <Bullet>To contact you about that order.</Bullet>
                    <Bullet>To take payment for it.</Bullet>
                    <Bullet>To keep your order history, if you use an account.</Bullet>
                    <Bullet>
                        To measure and improve our service, and — on the website and mobile app
                        only — to measure the effectiveness of our advertising.
                    </Bullet>
                    <Bullet>To meet our accounting and tax obligations.</Bullet>
                </Box>
            </Section>

            <Section title="4. Who we share it with">
                <P>
                    We do not sell your personal data. We share the minimum necessary with service
                    providers who act on our behalf:
                </P>
                <Box component="ul" sx={{pl: 3, mt: 0}}>
                    <Bullet>
                        <strong>Payment providers</strong> — to take and reconcile payment. They
                        receive the transaction, not your order details.
                    </Bullet>
                    <Bullet>
                        <strong>Translation service (DeepL)</strong> — the free-text note you add
                        to an order is sent for translation so our kitchen staff can read it. Do
                        not put personal information in that field.
                    </Bullet>
                    <Bullet>
                        <strong>Messaging providers (WhatsApp / Meta)</strong> — to send you the
                        one-time verification code and order notifications.
                    </Bullet>
                    <Bullet>
                        <strong>Push notification delivery (Expo, Google)</strong> — mobile app
                        only, to deliver order-status notifications to your device.
                    </Bullet>
                    <Bullet>
                        <strong>Advertising and measurement (Meta, TikTok)</strong> — website and
                        mobile app only. We send purchase events so we can measure our advertising,
                        and the phone numbers of our website customers, in hashed form, to Meta so we
                        can show our ads to our own customers or leave them out. A phone number you
                        have used in the mobile app is never sent to Meta for advertising.
                        <strong> Orders placed at a kiosk are never sent to these services.</strong>
                    </Bullet>
                    <Bullet>
                        <strong>Hosting and infrastructure providers</strong> — who store the data
                        on our behalf.
                    </Bullet>
                </Box>
            </Section>

            <Section title="5. How long we keep it">
                <P>
                    We keep order records for as long as we need them to run the business and to
                    satisfy accounting and tax requirements, including after you delete your
                    account. Account data is kept while your account exists. When data is no longer
                    needed for either purpose, it is deleted or anonymised.
                </P>
            </Section>

            <Section title="6. Your choices">
                <Box component="ul" sx={{pl: 3, mt: 0}}>
                    <Bullet>
                        You can order at a kiosk or on our website without creating an account.
                    </Bullet>
                    <Bullet>
                        You can turn off push notifications in your device settings at any time.
                    </Bullet>
                    <Bullet>
                        In the mobile app you can delete your account yourself — see section 7.
                    </Bullet>
                    <Bullet>
                        You can ask us for a copy of your data, ask us to correct it, or ask us to
                        delete it and your account — write to{' '}
                        <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>. We may need
                        to keep some records where the law requires it.
                    </Bullet>
                </Box>
            </Section>

            <Section title="7. Delete your account" id={DELETE_ACCOUNT_SECTION_ID}>
                <P>
                    In the IC Pizza mobile app, open your profile (top right), tap{' '}
                    <strong>•••</strong> and choose <strong>Delete account</strong>. The deletion
                    happens straight away.
                </P>
                <P>
                    <strong>What we delete:</strong> your account and its sign-in on every device,
                    your saved delivery addresses and your phone&apos;s notification token. From
                    then on we send you no marketing: no offers on WhatsApp, and your phone number
                    is left out of the customer lists we share with Meta.
                </P>
                <P>
                    <strong>What we keep:</strong> the records of the orders you placed (items,
                    amounts, branch and times), because they are part of our accounting and tax
                    records and our sales statistics. If you order again with the same phone number,
                    we still send you the messages about that order.
                </P>
                <P>
                    You can sign up again later with the same phone number; it starts a new, empty
                    account. If you do not use the app, write to{' '}
                    <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link> and we will
                    delete your data for you.
                </P>
            </Section>

            <Section title="8. Security">
                <P>
                    All traffic between our apps and our servers is encrypted in transit. Access to
                    order data is limited to staff who need it to do their job.
                </P>
            </Section>

            <Section title="9. Children">
                <P>
                    Our services are intended for adults. We do not knowingly collect data from
                    children.
                </P>
            </Section>

            <Section title="10. Changes">
                <P>
                    If we change this policy we will update the date at the top of this page.
                </P>
            </Section>
        </>
    );
}

function AstraCourierPolicy(): JSX.Element {
    return (
        <>
            <Typography variant="body2" color="text.secondary" sx={{mt: 1}}>
                Effective date: {COURIER_APP_EFFECTIVE_DATE}
            </Typography>

            <Divider sx={{my: 3}}/>

            <P>
                This policy explains what personal data the Astra Courier app collects from the
                delivery riders who use it, why we collect it, who can see it, how long we keep it,
                and how you can ask us for a copy or have it deleted.
            </P>
            <P>
                It applies only to riders using the Astra Courier app. Rider accounts are created by
                us; the app has no sign-up. If you order food from IC Pizza, the IC Pizza tab of
                this page applies to you instead.
            </P>

            <Section title="1. Who we are">
                <P>
                    {COURIER_APP_CONTROLLER} For any question about this policy or about your data,
                    write to <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>.
                </P>
            </Section>

            <Section title="2. What the app collects">
                <Box component="ul" sx={{pl: 3, mt: 0}}>
                    <Bullet>
                        <strong>Account details</strong> — the rider account we create for you: a
                        username, which is also the name customers see, the city you work in and,
                        if a manager adds it, a phone number our staff use to reach you during a
                        delivery. When you sign in, the app sends the username and password we
                        issued to you; our server checks the password, and the app keeps only a
                        session token, in your phone&apos;s secure storage.
                    </Bullet>
                    <Bullet>
                        <strong>Precise location, including in the background</strong> — from the
                        moment you go online, the app sends your location to our server, even when
                        the app is closed or not in use: every 60 seconds while you wait for
                        orders, and every 15 seconds while you carry one. A notification stays on
                        your phone for as long as this is happening. It stops when you go offline
                        or sign out. If our server takes you off shift because it has had no
                        position from you for 30 minutes while you were waiting for orders, the app
                        can keep sending your location until you sign out, or go online and then
                        offline again. Your position is also sent when you go online, when the app
                        draws the route for an order, and when you arrive at the kitchen or mark an
                        order delivered. If you have no signal, up to 500 recent positions are kept
                        on the phone and sent once you are back online.
                    </Bullet>
                    <Bullet>
                        <strong>Delivery photos</strong> — the photo you take at the door with the
                        in-app camera when you deliver an order. The app does not read your photo
                        gallery and does not use the microphone.
                    </Bullet>
                    <Bullet>
                        <strong>Delivery events</strong> — when you accept an order, arrive at the
                        kitchen, deliver it or return it undelivered, and whether you confirmed a
                        step while away from the expected location.
                    </Bullet>
                    <Bullet>
                        <strong>Shift and offer records</strong> — when you go online and offline,
                        and whether your shift ended because you went offline, signed out or sent
                        no position for too long; the orders offered to you that you declined or
                        let run out; and, when an order was not offered to you, the reason (for
                        example that you were too far away or already busy).
                    </Bullet>
                    <Bullet>
                        <strong>Device and app information</strong> — a push-notification token and
                        your phone&apos;s platform, so we can send you new-order alerts, and the app
                        version, so we can tell you when an update is required.
                    </Bullet>
                </Box>
                <P>
                    The app contains no advertising and no analytics or crash-reporting tools of its
                    own.
                </P>
            </Section>

            <Section title="3. Why we collect it">
                <Box component="ul" sx={{pl: 3, mt: 0}}>
                    <Bullet>To offer you orders from kitchens near you.</Bullet>
                    <Bullet>To show you the route to the kitchen and to the customer.</Bullet>
                    <Bullet>
                        To show the customer where their order is on a live map, and to tell them
                        when you are close.
                    </Bullet>
                    <Bullet>
                        To confirm that you arrived at the kitchen and at the delivery address, and
                        to resolve delivery disputes.
                    </Bullet>
                    <Bullet>To measure delivery and waiting times so we can plan our service.</Bullet>
                    <Bullet>
                        To keep track of your hours on shift and of the offers you took, declined
                        or missed.
                    </Bullet>
                    <Bullet>
                        To send you new-order alerts and tell you when an app update is required.
                    </Bullet>
                </Box>
            </Section>

            <Section title="4. Who can see it">
                <P>
                    We do not sell rider data and do not use it for advertising. It is seen only by:
                </P>
                <Box component="ul" sx={{pl: 3, mt: 0}}>
                    <Bullet>
                        <strong>The customer of the order you are carrying</strong> — while the order
                        is out for delivery, they see your name and your live position on a map, with
                        the direction you are heading and an estimated arrival time, and your name
                        appears in their order notifications. Your phone number is never shown to
                        them.
                    </Bullet>
                    <Bullet>
                        <strong>Our managers</strong> — your position, your route, your delivery
                        photos, your hours on shift and the offers you declined or missed, on our
                        dispatch board. If a customer questions a delivery, we may show them the
                        delivery photo for their order.
                    </Bullet>
                    <Bullet>
                        <strong>Google</strong> — the map inside the app is provided by Google Maps.
                        Our server asks Google to calculate the route for an order, sending it the
                        route&apos;s start and end points, and, while you carry an order, it keeps
                        sending Google your current position and the delivery address to estimate
                        when the order will arrive. If you choose to start navigation, the route
                        opens in the Google Maps app on your phone.
                    </Bullet>
                    <Bullet>
                        <strong>Messaging providers (WhatsApp / Meta)</strong> — when the customer
                        of your order gets order updates on WhatsApp, the message that their order
                        is on its way includes your name.
                    </Bullet>
                    <Bullet>
                        <strong>Push notification delivery (Expo, Google Firebase Cloud Messaging
                        and the push service of the customer&apos;s phone)</strong> — to deliver
                        new-order alerts to your phone, and order updates to the customer&apos;s
                        phone, some of which include your name.
                    </Bullet>
                    <Bullet>
                        <strong>Telegram</strong> — if we turn on delivery alerts for our managers,
                        they are sent to a managers&apos; group on Telegram, and an alert that an
                        offer ran out unanswered names the rider it was offered to.
                    </Bullet>
                    <Bullet>
                        <strong>Hosting and infrastructure providers</strong> — who store the data
                        on our behalf.
                    </Bullet>
                </Box>
            </Section>

            <Section title="5. How long we keep it">
                <Box component="ul" sx={{pl: 3, mt: 0}}>
                    <Bullet>
                        <strong>Location history</strong> — 90 days, then deleted automatically.
                        Your most recent position is kept with your rider account until a newer one
                        replaces it.
                    </Bullet>
                    <Bullet>
                        <strong>Delivery photos</strong> — deleted automatically 7 days after
                        upload, by a job that runs once a week, so a photo is gone 7 to 14 days
                        after you take it.
                    </Bullet>
                    <Bullet>
                        <strong>Delivery events</strong> — kept with the order record for as long as
                        we need it to run the business and to satisfy accounting and tax
                        requirements.
                    </Bullet>
                    <Bullet>
                        <strong>Shift and offer records</strong> — kept while your rider account
                        exists, for your hours on shift and your delivery statistics.
                    </Bullet>
                    <Bullet>
                        <strong>Account details</strong> — kept while your rider account exists.
                    </Bullet>
                </Box>
            </Section>

            <Section title="6. Your choices">
                <Box component="ul" sx={{pl: 3, mt: 0}}>
                    <Bullet>
                        You can stop location sharing at any time by going offline or signing out.
                        Signing out always stops it, including after our server has taken you off
                        shift.
                    </Bullet>
                    <Bullet>
                        You can withdraw the location, camera or notification permission in your
                        phone&apos;s settings at any time. Without location the app cannot send you
                        orders, and without the camera you cannot complete a delivery.
                    </Bullet>
                    <Bullet>
                        You can ask us for a copy of your data or ask us to correct it — write to{' '}
                        <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>. To have it
                        deleted, follow the steps in{' '}
                        <Link component={RouterLink} to={DELETE_DATA_PATH}>Delete your data</Link>.
                    </Bullet>
                </Box>
            </Section>

            <Section title="7. Delete your data" id={DELETE_DATA_SECTION_ID}>
                <P>
                    You can ask us to delete your Astra Courier account and the data linked to it at
                    any time, including after you stop working with us.
                </P>
                <Box component="ol" sx={{pl: 3, mt: 0}}>
                    <Bullet>
                        Send an email to{' '}
                        <Link href={`mailto:${CONTACT_EMAIL}`}>
                            {CONTACT_EMAIL}
                        </Link>{' '}
                        with the subject &quot;Astra Courier - delete my data&quot;. You can also ask
                        your dispatch manager to send it for you.
                    </Bullet>
                    <Bullet>
                        Include your full name and the phone number of your rider account, so we can
                        find it. Never send your password.
                    </Bullet>
                    <Bullet>
                        We confirm that we received your request within 7 days, may ask you to
                        confirm it from that phone number, and complete the deletion within 30 days.
                        We email you when it is done.
                    </Bullet>
                </Box>
                <P>
                    <strong>What we delete:</strong> your rider account (name, phone number and
                    login), your location history and your last known position, your phone&apos;s
                    notification token, your shift and offer records, and any delivery photos that
                    are still stored. Once your account is deleted you can no longer sign in to the
                    app.
                </P>
                <P>
                    <strong>What we keep:</strong> the records of the orders you delivered (order
                    number, times and amounts), because they are part of our accounting and tax
                    records. We keep them for as long as Bahrain&apos;s accounting and tax rules
                    require, with your name removed from them.
                </P>
            </Section>

            <Section title="8. Security">
                <P>
                    All traffic between the app and our servers is encrypted in transit. The app
                    keeps your session token in your phone&apos;s secure storage. Among our staff,
                    only managers can see rider location history and delivery photos, and a customer
                    can see your position only while you carry their order.
                </P>
            </Section>

            <Section title="9. Children">
                <P>
                    The app is intended only for our adult delivery riders. We do not knowingly
                    collect data from children.
                </P>
            </Section>

            <Section title="10. Changes">
                <P>
                    If we change this policy we will update the effective date at the top of this
                    tab.
                </P>
            </Section>
        </>
    );
}

interface PrivacyPolicyPageProps {
    tab: PrivacyPolicyTab;
    /** Scrolls this section into view on open: a link can then point at one part of a policy. */
    focusSectionId?: string;
}

export function PrivacyPolicyPage({tab, focusSectionId}: PrivacyPolicyPageProps): JSX.Element {
    const active = POLICY_TABS[tab];
    useEffect(() => {
        if (focusSectionId) {
            document.getElementById(focusSectionId)?.scrollIntoView();
        }
    }, [focusSectionId]);
    return (
        <Container maxWidth="md" sx={{py: {xs: 4, sm: 6}}}>
            <SeoHead title={active.seoTitle} description={active.seoDescription} path={active.path}/>
            <Typography variant="h4" component="h1" sx={{fontWeight: 700}}>
                {active.heading}
            </Typography>

            {/* Router links rather than local state, so every policy keeps an address of its own.
                role="navigation" + aria-current is MUI's "nav tabs" pattern: the tab list's
                arrow-key focus movement stays, and Enter follows the focused link. */}
            <Tabs
                value={tab}
                variant="fullWidth"
                role="navigation"
                aria-label="Privacy policies"
                sx={{mt: 2, borderBottom: 1, borderColor: 'divider'}}
            >
                {TAB_ORDER.map(id => (
                    <Tab
                        key={id}
                        value={id}
                        id={tabElementId(id)}
                        label={POLICY_TABS[id].label}
                        component={RouterLink}
                        to={POLICY_TABS[id].path}
                        aria-current={id === tab ? 'page' : undefined}
                        sx={{textTransform: 'none'}}
                    />
                ))}
            </Tabs>

            <Box role="tabpanel" aria-labelledby={tabElementId(tab)} sx={{mt: 2}}>
                {tab === 'delivery' ? <AstraCourierPolicy/> : <IcPizzaPolicy/>}
            </Box>
        </Container>
    );
}
