import { getSession } from '@/modules/auth/session';
import { redirect } from 'next/navigation';
import AuthForm from '@/modules/auth/components/AuthForm';
import ThemeToggle from '@/modules/theme/components/ThemeToggle';

const HEADLINES = [
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

export default async function Home() {
  const session = await getSession();

  // If already authenticated, redirect to the dashboard
  if (session) {
    redirect('/dashboard');
  }

  // Select a random headline on each request (force-dynamic ensures this runs per request)
  const randomIndex = Math.floor(Math.random() * HEADLINES.length);
  const [firstLine, secondLine] = HEADLINES[randomIndex];

  return (
    <div className="h-screen h-[100dvh] overflow-hidden bg-zinc-50 dark:bg-[#030303] text-zinc-900 dark:text-white font-sans flex flex-col justify-between selection:bg-purple-500 selection:text-white relative transition-colors duration-300">
      {/* Dynamic Glowing Blur Backgrounds */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-purple-900/5 dark:bg-purple-900/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-900/5 dark:bg-indigo-900/10 blur-[130px] pointer-events-none" />

      {/* Header */}
      <header className="max-w-7xl mx-auto w-full px-6 sm:px-8 py-3.5 sm:py-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2.5">
          <span className="text-xl font-black tracking-widest bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 bg-clip-text text-transparent">
            KIAN HQ
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900/50 font-bold tracking-wider">
            V1.2
          </span>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-500 font-bold tracking-wider uppercase">
            Backstage Pass
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full px-6 sm:px-8 py-4 sm:py-6 lg:py-12 flex flex-col lg:flex-row items-center justify-center gap-6 sm:gap-12 lg:gap-24 flex-1 z-10 overflow-hidden">
        {/* Left Hero Description */}
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left max-w-xl">
          <div className="hidden lg:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-purple-500/10 dark:border-purple-500/20 bg-purple-500/5 text-purple-600 dark:text-purple-400 text-xs font-bold mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
            Kreasi Inovasi Anak Nusantara
          </div>

          <h1 className="text-3xl sm:text-6xl font-black tracking-tight leading-[1.08] mb-3 sm:mb-6 bg-gradient-to-b from-zinc-950 to-zinc-600 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">
            {firstLine}<br />{secondLine}
          </h1>

          <p className="hidden lg:block text-base sm:text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6 font-medium">
            Kian HQ is the shared canvas where our collective imagination turns into reality.
          </p>
          <p className="hidden lg:block text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Together, we refine concepts, coordinate timelines, and craft digital experiences that leave a lasting mark.
          </p>
        </div>

        {/* Right Auth Form */}
        <div className="w-full max-w-md flex justify-center">
          <AuthForm />
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto w-full px-6 sm:px-8 py-3.5 sm:py-6 border-t border-zinc-200 dark:border-zinc-900/60 flex flex-col sm:flex-row justify-between items-center text-xs text-zinc-500 dark:text-zinc-400 gap-3 sm:gap-4 z-10">
        <div>
          &copy; {new Date().getFullYear()} Kian HQ. Fueling creative minds.
        </div>
        <div className="flex gap-6 font-bold tracking-wider uppercase text-[10px] text-zinc-500 dark:text-zinc-400">
          <span className="hover:text-zinc-700 dark:hover:text-zinc-400 transition-colors cursor-default">Studio Sandbox</span>
          <span className="hover:text-zinc-700 dark:hover:text-zinc-400 transition-colors cursor-default">Safe Haven</span>
          <span className="hover:text-zinc-700 dark:hover:text-zinc-400 transition-colors cursor-default">Frictionless Flow</span>
        </div>
      </footer>
    </div>
  );
}

export const dynamic = 'force-dynamic';
