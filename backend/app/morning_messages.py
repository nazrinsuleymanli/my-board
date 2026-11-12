"""Morning words. Hand-written, positive only. One quote + one ♓ Pisces line per day (same all day long)."""

QUOTES = [
    "Small steps every day still add up to a whole road.",
    "You don’t have to feel ready. You just have to start.",
    "Discipline is choosing what you want most over what you want now.",
    "Do it tired. Do it bored. Do it anyway.",
    "One focused hour beats a whole distracted day.",
    "Progress, not perfection.",
    "You have survived every hard day so far. Today is no exception.",
    "Future you is cheering for what you do this morning.",
    "Slow is fine. Stopping is the only thing that isn’t.",
    "Make today the kind of day you’d like to remember.",
    "Consistency is a quiet kind of magic.",
    "Your only competition is who you were yesterday.",
    "Start where you are. Use what you have. Do what you can.",
    "Hard things get easier the moment you begin them.",
    "A calm mind writes better code and better days.",
    "You moved to a new country and built a life. You can finish one task.",
    "Win the morning, and the day follows.",
    "Rest if you must, but don’t quit.",
    "Every expert was once a beginner who kept going.",
    "Be proud of how far you’ve already come.",
    "Today’s effort is tomorrow’s ease.",
    "Little by little, a little becomes a lot.",
    "The best time to start was earlier. The second best is now.",
    "Focus on the next right thing — just one.",
    "You are allowed to be both a masterpiece and a work in progress.",
    "Energy flows where attention goes.",
    "Brave doesn’t mean not scared. It means going anyway.",
    "Good things are coming. Keep showing up for them.",
    "Done is better than perfect.",
    "Your dreams are valid, and so is your pace.",
]

PISCES = [
    "♓ Your intuition is extra sharp today — trust the first feeling you get.",
    "♓ Creative energy is flowing. A small idea today could grow into something big.",
    "♓ Kindness you give today finds its way back to you, often from where you least expect.",
    "♓ Neptune favours your imagination: perfect day to plan, design and dream a little.",
    "♓ A conversation today brings clarity. Say the thing you’ve been holding in.",
    "♓ Your calm is your superpower today. Others will feel safe around you.",
    "♓ Good news may arrive quietly — keep an eye on your messages.",
    "♓ Today rewards patience. What you started weeks ago is starting to bloom.",
    "♓ Water signs shine when they flow — don’t force it, and things fall into place.",
    "♓ Someone appreciates you more than they say. You’ll feel it today.",
    "♓ Your focus is unusually strong this morning. Use it on the hardest task first.",
    "♓ A lucky little coincidence is on its way. Smile when you notice it.",
    "♓ Your empathy turns ordinary moments into warm ones today.",
    "♓ The stars line up for learning: whatever you study today sticks.",
    "♓ A door you knocked on earlier is getting ready to open.",
    "♓ Your gentle persistence is your secret strength. Keep going softly.",
    "♓ Today is great for fresh starts — tidy one corner, start one habit.",
    "♓ Your creativity solves a problem that logic alone couldn’t.",
    "♓ You attract helpful people today. Accept the help.",
    "♓ Your heart and your plans agree today — move forward with confidence.",
    "♓ Something you’ve been worrying about turns out lighter than you thought.",
    "♓ The Moon supports your mood today: a cozy, productive kind of day.",
    "♓ A compliment is coming your way. Believe it.",
    "♓ Your dreams last night had a message: you’re on the right path.",
    "♓ Today you’ll find exactly the right words, in English and in Azerbaijani.",
    "♓ Abundance energy: a small win today hints at bigger ones ahead.",
    "♓ You’re glowing today — people notice your warmth.",
    "♓ Perfect day to connect with family. A short call will make two hearts happy.",
    "♓ Your hard work is being seen, even if no one says it yet.",
    "♓ Flow like water: adapt, keep moving, reach the sea.",
    "♓ Everything you need for today is already inside you.",
]


def greeting(hour: int) -> str:
    if hour < 5:
        return "Hello, night owl"
    if hour < 12:
        return "Good morning, Nazrin"
    if hour < 18:
        return "Good afternoon, Nazrin"
    return "Good evening, Nazrin"


def for_day(ordinal: int) -> dict:
    # different strides so the pair of quote + Pisces line doesn't repeat in a fixed cycle
    return {"quote": QUOTES[(ordinal * 7) % len(QUOTES)], "pisces": PISCES[(ordinal * 11) % len(PISCES)]}
