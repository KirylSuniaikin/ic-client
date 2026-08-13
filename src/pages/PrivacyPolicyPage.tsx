import React from 'react';
import {Box, Container, Divider, Link, Typography} from '@mui/material';

// Deliberately NOT wired to i18n. The six shared locale namespaces are byte-identical to
// ic-pizza-mobile's and pinned by a parity test there, so adding keys here would break the
// mobile suite. A legal document also needs a reviewed translation rather than a machine one —
// when the Arabic version is ready, add it as a separate route or a web-only namespace.

const LAST_UPDATED = '10 August 2026';

// TODO(legal): replace the three placeholders below before publishing.
const COMPANY_LEGAL_NAME = '[LEGAL ENTITY NAME]';
const COMPANY_ADDRESS = '[REGISTERED ADDRESS]';
const CONTACT_EMAIL = '[privacy@ic-pizza.com]';

function Section({title, children}: {title: string; children: React.ReactNode}): JSX.Element {
    return (
        <Box sx={{mt: 4}}>
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

export function PrivacyPolicyPage(): JSX.Element {
    return (
        <Container maxWidth="md" sx={{py: {xs: 4, sm: 6}}}>
            <Typography variant="h4" component="h1" sx={{fontWeight: 700}}>
                Privacy Policy
            </Typography>
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
                        <strong>Delivery address and approximate location</strong> — website and
                        mobile app only, and only when you choose delivery.
                    </Bullet>
                    <Bullet>
                        <strong>Account data</strong> — website and mobile app only. We verify your
                        phone number with a one-time code and keep a record of your past orders.
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
                    kiosk, on the physical card terminal next to it. Card numbers do not pass
                    through our apps or our servers.
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
                        mobile app only. We send purchase events so we can measure our advertising.
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
                    satisfy accounting and tax requirements. Account data is kept while your
                    account exists. When data is no longer needed for either purpose, it is deleted
                    or anonymised.
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
                        You can ask us for a copy of your data, ask us to correct it, or ask us to
                        delete it and your account — write to{' '}
                        <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>. We may need
                        to keep some records where the law requires it.
                    </Bullet>
                </Box>
            </Section>

            <Section title="7. Security">
                <P>
                    All traffic between our apps and our servers is encrypted in transit. Access to
                    order data is limited to staff who need it to do their job.
                </P>
            </Section>

            <Section title="8. Children">
                <P>
                    Our services are intended for adults. We do not knowingly collect data from
                    children.
                </P>
            </Section>

            <Section title="9. Changes">
                <P>
                    If we change this policy we will update the date at the top of this page.
                </P>
            </Section>
        </Container>
    );
}
