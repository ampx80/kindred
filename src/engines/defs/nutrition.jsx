// The Nourishment engine. For the person who wants to eat in a way that gives
// them energy instead of guilt. Every tool is generative: it takes the person's
// goal and constraints plus what Aria already knows about them, and returns a
// warm, practical, non-judgmental plan. This is general guidance and never
// medical or clinical advice. No em-dashes or en-dashes anywhere (ASCII hyphen
// only) - this ships to the generator too.

// Shared voice and format tail stitched into every systemPrompt so the whole
// engine sounds like one kind, grounded companion who already knows this person,
// keeps things non-clinical, and respects any stated allergies or conditions.
const VOICE = `Write as Aria, a warm, encouraging companion who already knows this person from their profile. Speak to them directly as "you". No preamble, no restating the request, no sign-off. Output markdown only: use ## headings for each section and - bullets or numbered lists for anything with steps or items. Be practical, specific, and kind, never preachy and never shaming. Food is not a moral test; there are no "good" or "bad" foods here, only what helps this person feel good and fits their life.

This is general nutrition guidance for everyday wellbeing, not medical, clinical, or therapeutic advice, and not a treatment plan. Respect every allergy, restriction, or condition the person names as a hard line and never suggest anything that violates it. If a goal sounds like it needs a professional (a medical condition, disordered eating, or a big medical diet change), gently say one line that a doctor or registered dietitian is the right person for that, then keep your help general and supportive. Never use em-dashes or en-dashes; use a plain hyphen "-" only.`;

const engine = {
  id: 'nutrition',
  name: 'Nourishment',
  tagline: 'Eat in a way that gives you energy, not guilt.',
  emoji: '\u{1F957}',
  color: 'var(--sage)',
  bg: 'var(--sage-bg)',
  keywords: [
    'food', 'eat', 'eating', 'nutrition', 'meal', 'meals', 'diet', 'cook',
    'cooking', 'recipe', 'recipes', 'healthy', 'protein', 'weight', 'energy',
    'hydration', 'vegetarian', 'vegan',
  ],
  domains: ['body', 'rest'],
  blurb:
    'A kind, practical partner for eating well. Aria plans a full week of simple ' +
    'meals around your goals and constraints, turns whatever is in your kitchen ' +
    'into a real recipe, writes an organized grocery list, and matches food to how ' +
    'you actually want to feel. No calorie policing, no guilt, no fads. Just food ' +
    'that fits your life. This is general guidance, not medical advice.',

  tools: [
    {
      id: 'meal-plan',
      name: 'Weekly meal plan',
      desc: 'A full week of simple meals built around your goal and constraints.',
      icon: 'target',
      feature: {
        id: 'nutrition-meal-plan',
        title: 'Weekly meal plan',
        outputTitle: 'Your week of meals',
        blurb:
          'Tell Aria your goal, any restrictions, and how much you like to cook. ' +
          'She will lay out a simple, realistic week you can actually eat.',
        icon: 'target',
        cta: 'Plan my week',
        inputs: [
          {
            key: 'goal',
            label: 'What are you going for',
            type: 'select',
            options: ['More energy', 'Lose fat gently', 'Build muscle', 'Eat more whole foods', 'Save time', 'Save money'],
          },
          {
            key: 'restrictions',
            label: 'Anything to work around (pick any)',
            type: 'chips',
            options: ['Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free', 'Nut allergy', 'Halal', 'Kosher', 'None'],
          },
          {
            key: 'cookingTime',
            label: 'How much do you want to cook',
            type: 'select',
            options: ['Barely any', '20 min', 'I enjoy cooking'],
          },
        ],
        systemPrompt: `${VOICE}

Build a full, realistic 7-day meal plan for this person that fits their goal, treats every listed restriction as a hard line, and matches how much they actually want to cook. Keep meals simple, affordable where it matters, and made from normal grocery-store ingredients. Repeat components across days on purpose so it is easy to shop for and cook.

## The week at a glance
- One short, warm paragraph naming their goal and how this week gently serves it, plus one honest line that this is flexible and there are no wrong choices.

## Day-by-day meals
For each of the 7 days, use a "## Day N" heading with four bullets:
- Breakfast - a simple option with the key ingredients named.
- Lunch - simple, often a leftover or quick assembly.
- Dinner - the main cooked meal, still easy.
- Snack - one or two easy grab options.
Scale portions and effort to their cooking-time choice: if they picked "Barely any", lean on no-cook and assembly meals; if "I enjoy cooking", a couple can be a little more involved.

## Batch-cook tips
- 2 to 3 concrete tips for cooking once and eating several times this week (for example, a big pot of a base grain, a tray of roasted vegetables, or a protein cooked in bulk), each with what it unlocks across the days above.`,
      },
    },

    {
      id: 'recipe-from-have',
      name: 'Recipe from what I have',
      desc: 'Turn whatever is in your kitchen into a couple of real meals.',
      icon: 'sparkles',
      feature: {
        id: 'nutrition-recipe-from-have',
        title: 'Recipe from what I have',
        outputTitle: 'What you can make right now',
        blurb:
          'List what is in your fridge and pantry and Aria will turn it into a ' +
          'couple of simple recipes, using mostly what you already have.',
        icon: 'sparkles',
        cta: 'Make me something',
        inputs: [
          {
            key: 'ingredients',
            label: 'What do you have on hand',
            type: 'textarea',
            placeholder: 'e.g. eggs, half an onion, rice, a can of black beans, cheddar, spinach that needs using...',
          },
          {
            key: 'constraints',
            label: 'Anything to keep in mind (optional)',
            type: 'text',
            placeholder: 'e.g. no dairy, ready in 20 min, feeding two, no oven',
          },
        ],
        systemPrompt: `${VOICE}

Turn what this person has on hand into 2 to 3 simple recipes that use mostly the ingredients they listed. Assume basic pantry staples (salt, pepper, oil, common spices) are available, but do not invent major ingredients they did not mention. Honor every constraint they gave as a hard line.

For each recipe use a "## Recipe name" heading and inside it:
- One warm line on what it is and why it works with what they have.
- Ingredients - a short bullet list, marking anything optional.
- Steps - a numbered list of clear, simple steps.
- Swaps - one or two bullets for easy substitutions if they are missing something or want to change it up.

End with one short "## If you want to round it out" section: a couple of simple ideas for a side or add-on that would make any of these a fuller meal.`,
      },
    },

    {
      id: 'grocery-list',
      name: 'Grocery list',
      desc: 'An organized, by-section shopping list for simple meals.',
      icon: 'book',
      feature: {
        id: 'nutrition-grocery-list',
        title: 'Grocery list',
        outputTitle: 'Your grocery list',
        blurb:
          'Tell Aria your goal and how many days you are shopping for and she will ' +
          'write a clean, organized list grouped by aisle.',
        icon: 'book',
        cta: 'Build my list',
        inputs: [
          {
            key: 'goal',
            label: 'What are you shopping toward',
            type: 'text',
            placeholder: 'e.g. easy high-protein dinners, more veggies, budget week...',
          },
          {
            key: 'people',
            label: 'How many people (optional)',
            type: 'text',
            placeholder: 'e.g. just me, 2 adults, family of 4',
          },
          {
            key: 'days',
            label: 'How many days',
            type: 'select',
            options: ['3', '5', '7'],
          },
        ],
        systemPrompt: `${VOICE}

Write an organized grocery list that supports simple, realistic meals for this person over the number of days they chose, scaled to how many people they are feeding (assume one person if not stated) and aimed at their stated goal. Keep it to normal, affordable ingredients and lean on items that stretch across several meals.

## The idea
- One or two short lines on the kind of simple meals this list supports across the period, so the list makes sense.

## The list
Group items by store section, each as its own "## Section" heading (for example Produce, Proteins, Dairy or alternatives, Grains and bread, Pantry and canned, Frozen, Snacks, Other), with a bullet under each for the specific items and rough quantities. Only include sections that have items.

## Make it stretch
- 2 to 3 bullets on how a few of these ingredients carry across multiple meals, so nothing goes to waste.`,
      },
    },

    {
      id: 'eat-to-feel',
      name: 'Eat for how you want to feel',
      desc: 'Practical food patterns for the way you want your body to feel.',
      icon: 'leaf',
      feature: {
        id: 'nutrition-eat-to-feel',
        title: 'Eat for how you want to feel',
        outputTitle: 'Food for how you want to feel',
        blurb:
          'Pick the feeling you are after and Aria will give you the food patterns ' +
          'and a few go-to meals that tend to help you get there.',
        icon: 'leaf',
        cta: 'Show me how',
        inputs: [
          {
            key: 'want',
            label: 'What are you after',
            type: 'select',
            options: ['Steady energy', 'Better sleep', 'Sharper focus', 'Less bloating', 'Post-workout'],
          },
        ],
        systemPrompt: `${VOICE}

Help this person eat in a way that supports how they want to feel, based on the goal they picked. Keep it grounded in widely accepted, everyday nutrition ideas, framed gently, and remind them in one short line that bodies differ and this is general guidance, not a rule or a diagnosis. Respect any allergies or conditions in their profile.

## Why this helps
- 2 to 3 short bullets on the simple, practical reasons certain foods and timing tend to support this feeling. Keep it plain and non-clinical.

## Patterns that help
- A bullet list of practical habits for this goal (what to lean toward, what tends to work against it, and any helpful timing), written as gentle nudges, not commandments.

## A few go-to meals or snacks
- 3 to 5 simple, specific meal or snack ideas that fit this goal, each with the key ingredients named so they can actually make it.

## One easy start
- One single, low-effort thing they could try today to move toward this feeling.`,
      },
    },
  ],

  // A gentle daily nudge for the engine home. Small, kind, never a lecture.
  daily: (ctx) => ({
    title: 'One kind thing for your body today',
    body:
      'Eating well is not about being perfect. It is a lot of small, gentle choices: ' +
      'a glass of water, one more vegetable on the plate, prepping a single meal so ' +
      'future-you has something good waiting. Pick one today and let it count. When ' +
      'you want a real plan, I can lay out an easy week around your goals and whatever ' +
      'you do or do not eat.',
    cta: 'Plan my week',
    toolId: 'meal-plan',
  }),

  ariaContext: (profile) => {
    const name = (profile && profile.name) ? profile.name.split(' ')[0] : 'this person';
    return (
      `${name} cares about eating well and wants food to feel like fuel and comfort, ` +
      'not a source of guilt. The Nourishment engine is active, so you can plan a full ' +
      'week of simple meals, turn what is in their kitchen into recipes, write organized ' +
      'grocery lists, and match food to how they want to feel, always within any ' +
      'allergies, restrictions, or conditions they have named. Keep it warm, practical, ' +
      'and non-judgmental, with no calorie policing or fad diets. This is general ' +
      'wellbeing guidance, not medical or clinical advice; if something sounds like it ' +
      'needs a doctor or registered dietitian, say so kindly and keep your help general.'
    );
  },
};

export default engine;
