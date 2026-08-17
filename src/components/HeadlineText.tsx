'use client';

import { useState, useEffect } from 'react';

const HEADLINES: [string, string][] = [
  ["Unleash Ideas.", "Shape Stories."],
  ["Dream Big.", "Craft Beautifully."],
  ["Think Wild.", "Deliver Refined."],
  ["Bold Concepts.", "Seamless Execution."],
  ["Imagine More.", "Limit Less."],
  ["Inspire Change.", "Create Impact."],
  ["Make Waves.", "Stay True."],
  ["Spark Creativity.", "Drive Action."],
  ["Innovate Daily.", "Inspire Always."],
  ["Shape Culture.", "Build Future."],
  ["Chase Inspiration.", "Capture Excellence."],
  ["Craft Experiences.", "Evoke Emotions."],
  ["Create Wonder.", "Deliver Magic."],
  ["Design Tomorrow.", "Today."],
  ["Elevate Brands.", "Tell Stories."],
  ["Fuel Innovation.", "Spark Growth."],
  ["Define Modern.", "Design Classic."],
  ["Challenge Norms.", "Create Wonders."],
  ["Artistry First.", "Strategy Always."],
  ["Break Barriers.", "Make Art."],
  ["Pure Imagination.", "Perfect Delivery."],
  ["Create Boldly.", "Live Fully."],
  ["Invent Concepts.", "Inspire Minds."],
  ["Think Outside.", "Create Within."],
  ["Design Boldly.", "Deliver Simply."],
  ["Crafting Dreams.", "Sharing Realities."],
  ["Push Boundaries.", "Spark Minds."],
  ["Curating Beauty.", "Crafting Code."],
  ["Imagine Boldly.", "Execute Precisely."],
  ["Original Thought.", "Perfect Finish."],
  ["Sculpting Ideas.", "Painting Futures."],
  ["Where Creativity.", "Meets Clarity."],
  ["Endless Curiosity.", "Boundless Creation."],
  ["Mastering Art.", "Simplifying Complexity."],
  ["Write Stories.", "Build Worlds."],
  ["Cultivate Ideas.", "Harvest Magic."],
  ["Ignite Spark.", "Flow Free."],
  ["Wild Hearts.", "Styled Minds."],
  ["Create Waves.", "Stand Out."],
  ["Beyond Boundaries.", "Into Wonder."],
  ["Make Statement.", "Leave Mark."],
  ["Design Elegance.", "Craft Emotion."],
  ["Concept to Canvas.", "Mind to Masterpiece."],
  ["Pioneering Vision.", "Polished Detail."],
  ["Shape Spaces.", "Tell Stories."],
  ["Whisper Ideas.", "Shout Creation."],
  ["True Originality.", "True Quality."],
  ["Crafting Legacy.", "One Pixel at a Time."],
  ["Infinite Ideas.", "One Workspace."],
  ["Fresh Perspectives.", "Timeless Designs."],
  ["Wired to Create.", "Driven to Inspire."],
  ["Crafted with Passion.", "Managed with Grace."],
  ["Elevating Art.", "Celebrating Vision."],
  ["Beyond Common.", "Into Extraordinary."],
  ["Scribble Drafts.", "Publish Masterpieces."],
  ["Artistic Freedom.", "Structured Flow."],
  ["Bold Visions.", "Flawless Delivery."],
  ["Igniting Minds.", "Creating Wonders."],
  ["Designing Moments.", "Crafting Memories."],
  ["Where Passion.", "Meets Precision."],
  ["Dreamers Unite.", "Creators Deliver."],
  ["Raw Imagination.", "Cooked to Perfection."],
  ["Visual Poetry.", "Strategic Depth."],
  ["Dare to Dream.", "Care to Craft."]
];

export default function HeadlineText() {
  const [headline, setHeadline] = useState<[string, string]>(HEADLINES[0]);

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * HEADLINES.length);
    setHeadline(HEADLINES[randomIndex]);
  }, []);

  return (
    <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08] mb-3 sm:mb-6 bg-gradient-to-b from-zinc-950 to-zinc-600 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">
      {headline[0]}<br />{headline[1]}
    </h1>
  );
}
