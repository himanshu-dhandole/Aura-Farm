"use client";
import { Button } from "@heroui/button";
import { ArrowRight, Check } from "lucide-react";

const Hero = () => {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header id="#home"
      className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden bg-white"
      aria-labelledby="hero-heading"
    > 
      <div className="mt-34 relative z-10 text-center max-w-5xl w-full">
    
        {/* Main heading */}
        <h1
          id="hero-heading"
          className="text-[56px] sm:text-[72px] md:text-[84px] lg:text-[96px] font-serif tracking-tight leading-[0.95] text-gray-900 mb-6"
        >
          <span className="italic font-light text-gray-600">Build</span> your dream
          <br />
          <span className="font-normal">Startup</span>
          <span className="text-gray-600">.</span>
        </h1>

        {/* Value proposition */}
        <p className="mt-7 text-[19px] sm:text-[22px] font-semibold text-gray-900 tracking-tight">
          Elite freelance engineers, designers & product leaders
        </p>

        {/* Supporting description */}
        <p className="mt-5 text-[15px] sm:text-[17px] text-gray-700 max-w-[750px] mx-auto leading-relaxed font-light">
          We partner with startups and product teams to ship robust, production-ready systems — fast. 
          Frontend, backend, infrastructure, and end-to-end product delivery from a single trusted team.
        </p>

        {/* Key differentiators */}
        <div className="mt-8 flex items-center justify-center gap-6 flex-wrap text-[14px] text-gray-700">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-gray-900" />
            <span className="font-light">No agencies</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-gray-900" />
            <span className="font-light">Direct access</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-gray-900" />
            <span className="font-light">Production-grade</span>
          </div>
        </div>

        {/* Primary CTA */}
        <div className="mt-12 flex items-center justify-center gap-4">
          <Button
            size="lg"
            onClick={() => scrollToSection('contact')}
            className="rounded-full text-[14px] bg-gray-900 text-white hover:bg-gray-800 font-medium px-8 h-12 shadow-lg hover:shadow-xl transition-all inline-flex items-center"
            aria-label="Get a proposal"
          >
            GET A PROPOSAL
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            size="lg"
            onClick={() => scrollToSection('projects')}
            className="rounded-full text-[14px] bg-white text-gray-900 border border-gray-200 hover:bg-gray-50 font-medium px-8 h-12 shadow-sm hover:shadow-md transition-all inline-flex items-center"
            aria-label="View our work"
          >
            VIEW WORK
          </Button>
        </div>

        {/* Social proof metrics */}
        <div className="mt-24 pt-12 border-t border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 sm:gap-8 max-w-3xl mx-auto">
            <div className="text-center">
              <p className="text-[36px] font-serif text-gray-900 mb-1">50+</p>
              <p className="text-[13px] font-medium text-gray-600 uppercase tracking-wide">Projects Shipped</p>
              <p className="mt-1 text-[12px] text-gray-500 font-light">On time, on budget</p>
            </div>

            <div className="text-center">
              <p className="text-[36px] font-serif text-gray-900 mb-1">100%</p>
              <p className="text-[13px] font-medium text-gray-600 uppercase tracking-wide">Client Satisfaction</p>
              <p className="mt-1 text-[12px] text-gray-500 font-light">Zero failed deliveries</p>
            </div>

            <div className="text-center">
              <p className="text-[36px] font-serif text-gray-900 mb-1">24h</p>
              <p className="text-[13px] font-medium text-gray-600 uppercase tracking-wide">Response Time</p>
              <p className="mt-1 text-[12px] text-gray-500 font-light">Direct communication</p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.8s ease-out;
        }
      `}</style>
    </header>
  );
};

export default Hero;