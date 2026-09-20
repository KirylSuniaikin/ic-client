export type FaqItem = {
    question: string;
    answer: string;
};

// Answers sourced directly from the business owner -- update this file (not the JSON-LD builder)
// when an answer changes, e.g. once direct delivery or Benefit/BenefitPay go live.
export const MENU_PAGE_FAQ: FaqItem[] = [
    {
        question: 'Do you deliver everywhere in Bahrain?',
        answer: 'Yes — delivery across all of Bahrain is available today through Talabat and Keeta. Direct delivery through our own website and app is still being rolled out.',
    },
    {
        question: 'Is there a minimum order for pickup?',
        answer: "No minimum order for pickup. Delivery minimums and fees via Talabat and Keeta follow those platforms' own terms.",
    },
    {
        question: 'What payment methods do you accept?',
        answer: "Cash and card are accepted for pickup. For delivery via Talabat or Keeta, payment follows those platforms' own options. Benefit and BenefitPay support is coming soon.",
    },
    {
        question: 'Do you have vegetarian pizza options?',
        answer: 'Yes — our Veggie Mexican pizza is fully vegetarian.',
    },
    {
        question: 'Can I get a thin crust pizza?',
        answer: 'Yes, thin crust is available for every pizza on the menu in Medium and Large sizes.',
    },
    {
        question: 'Do you have a dine-in restaurant?',
        answer: 'No — IC Pizza is pickup and delivery only, ordered via self-service kiosk, our website, or delivery apps. There is no dine-in seating.',
    },
    {
        question: 'Do you take bulk or party orders?',
        answer: "Yes, we're happy to take bulk and party orders — call us to arrange.",
    },
];
