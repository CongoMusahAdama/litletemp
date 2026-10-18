// One question a day, the same for both partners.
const QUESTIONS = [
  'What is a small thing I did this week that made you smile?',
  'When did you first realise you liked me?',
  'What is your favourite memory of us so far?',
  'If we could go anywhere tomorrow, where would you take me?',
  'What song makes you think of me?',
  'What is one thing you want us to try together this year?',
  'What do you love most about how I talk to you?',
  'Describe our perfect lazy Sunday.',
  'What is something you have never told me but want to?',
  'Which of my habits secretly makes you laugh?',
  'What does home feel like to you?',
  'What is a food that will always remind you of us?',
  'What was going through your head on our first date?',
  'If our love story were a movie, what would it be called?',
  'What is one way I can make your day better tomorrow?',
  'What is the sweetest message I have ever sent you?',
  'What are you most proud of me for?',
  'Which outfit of mine is your favourite?',
  'What do you want our life to look like in five years?',
  'What is a dream you have not told many people about?',
  'What is your love language, and how can I speak it more?',
  'Which moment with me do you wish you could relive?',
  'What is one thing that always calms you down?',
  'What is your favourite way to be comforted when you are sad?',
  'What little detail about me do you notice that others miss?',
  'Plan our next date in three words.',
  'What made you laugh the hardest this week?',
  'What is something new you learned about me recently?',
  'Which nickname for me is your favourite and why?',
  'What would you write on a note to me for a hard day?',
  'Morning person or night person, and what do you love about that time with me?',
  'What is a tradition you want us to start?',
  'What is the bravest thing you have ever done?',
  'If you could give me one superpower, what would it be?',
  'What is your favourite photo of us and why?',
  'What do you miss most when we are apart?',
  'What is one fear you would like us to face together?',
  'What made today good, or what would have made it better?',
  'Which place would you love to live with me one day?',
  'What is a compliment from me you still remember?',
  'What is your ideal way to celebrate our anniversary?',
  'What is something you are looking forward to this month?',
  'What did you think of me the very first time we met?',
  'What is the best gift you have ever received?',
  'What is one thing you want me to never stop doing?',
  'Which of our inside jokes is your favourite?',
  'What does a perfect hug feel like to you?',
  'If we had a theme song, what would it be?',
  'What is something you want to get better at, and how can I help?',
  'When do you feel most loved by me?',
  'What three words describe us as a couple?',
  'What would your dream surprise from me look like?',
  'What is something you are grateful for today?',
  'What childhood memory do you want to share with me?',
  'If you could freeze one moment of today, which would it be?',
  'Which song should be on our road trip playlist?',
  'What is one promise you want to make to me?',
  'What makes you feel safe with me?',
  'What is your favourite thing about our chats?',
  'Finish this sentence: I knew you were special when…',
];

function dayNumber(day) {
  return Math.floor(new Date(`${day}T00:00:00Z`).getTime() / 86400000);
}

function questionFor(coupleId, day) {
  const seed = String(coupleId).split('').reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) % 997, 7);
  const index = (dayNumber(day) + seed) % QUESTIONS.length;
  return { index, text: QUESTIONS[index] };
}

module.exports = { QUESTIONS, questionFor };
