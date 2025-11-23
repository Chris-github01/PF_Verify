import { Target, Zap, Shield, CheckCircle, ArrowRight, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

interface LandingPageProps {
  onSignIn: () => void;
}

export default function LandingPage({ onSignIn }: LandingPageProps) {
  const [showDemoModal, setShowDemoModal] = useState(false);

  const trustedCompanies = [
    'Optimal Fire',
    'FR Coatings',
    'PyroTech',
    'FireSafe Solutions',
    'Passive Protection Ltd',
    'Elite Firestopping',
    '127+ others'
  ];

  return (
    <div className="min-h-screen bg-white">
      <nav className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <Shield className="text-blue-600" size={32} />
              <span className="text-xl font-bold text-gray-900">PassiveFire Verify+</span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a href="#how-it-works" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">How It Works</a>
              <a href="#pricing" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Pricing</a>
              <a href="#customers" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Customers</a>
              <a href="#resources" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Resources</a>
              <a href="#support" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Support</a>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onSignIn}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => setShowDemoModal(true)}
                className="hidden sm:block px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all shadow-sm"
              >
                See a Live Demo
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-16">
        <section className="relative overflow-hidden bg-gradient-to-b from-gray-50 via-white to-white py-20 sm:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-5xl mx-auto">
              <div className="flex flex-wrap justify-center gap-3 mb-8">
                <span className="px-4 py-2 text-sm font-medium text-orange-700 bg-orange-100 rounded-full border border-orange-200">
                  Estimators
                </span>
                <span className="px-4 py-2 text-sm font-medium text-purple-700 bg-purple-100 rounded-full border border-purple-200">
                  Technical Managers
                </span>
                <span className="px-4 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-full border border-green-200">
                  Directors
                </span>
              </div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 tracking-tight leading-tight">
                Never Get Screwed on<br />
                <span className="bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                  Passive Fire Scope Again
                </span>
              </h1>

              <p className="text-2xl sm:text-3xl font-semibold text-blue-600 mb-4">
                AI Trade Intelligence for Specialist Subcontractors
              </p>

              <p className="text-base sm:text-lg text-gray-600 mb-6 max-w-3xl mx-auto">
                Used on 500+ projects to protect margins and win fair pricing
              </p>

              <p className="text-lg sm:text-xl text-gray-700 mb-12 max-w-3xl mx-auto leading-relaxed">
                We read every quote like a 30-year passive fire expert — then show you exactly where they're trying to underpay or over-risk you.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                <button
                  onClick={onSignIn}
                  className="group px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                  Analyse Your First Quote Free
                  <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
                </button>
                <button
                  onClick={() => setShowDemoModal(true)}
                  className="px-8 py-4 text-lg font-semibold text-gray-700 bg-white border-2 border-gray-300 rounded-xl hover:border-gray-400 transition-all shadow-sm hover:shadow-md"
                >
                  See a Live Demo
                </button>
              </div>

              <div className="relative overflow-hidden py-4 bg-gradient-to-r from-transparent via-blue-50 to-transparent rounded-lg">
                <div className="flex animate-scroll whitespace-nowrap">
                  {[...trustedCompanies, ...trustedCompanies].map((company, idx) => (
                    <span key={idx} className="inline-block px-8 text-sm font-medium text-gray-600">
                      Used by {company}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-3 gap-12">
              <div className="text-center group">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-2xl mb-6 group-hover:bg-red-200 transition-colors">
                  <AlertTriangle className="text-red-600" size={32} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Instant Scope Gap Detection</h3>
                <p className="text-gray-600 leading-relaxed">
                  Highlights missing penetrations, wrong certifications, excluded testing in under 45 seconds. No more hidden exclusions.
                </p>
              </div>

              <div className="text-center group">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-6 group-hover:bg-blue-200 transition-colors">
                  <Target className="text-blue-600" size={32} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Apples-to-Apples Normalisation</h3>
                <p className="text-gray-600 leading-relaxed">
                  Maps every supplier's terminology to your master library — no more "Hilti vs Promat" confusion or unfair comparisons.
                </p>
              </div>

              <div className="text-center group">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl mb-6 group-hover:bg-green-200 transition-colors">
                  <CheckCircle className="text-green-600" size={32} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Bulletproof Counter-Analysis</h3>
                <p className="text-gray-600 leading-relaxed">
                  Generates board-ready reports that force fair pricing and full scope inclusion. Show the QS exactly where they're wrong.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                Stop Losing Money on Scope Confusion
              </h2>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Every quote you receive is a negotiation. Most subcontractors lose because they can't prove what's missing or unfair. We give you the evidence.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={onSignIn}
                  className="group px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                  Analyse Your First Quote Free
                  <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Shield className="text-blue-500" size={24} />
                <span className="text-lg font-bold text-white">PassiveFire Verify+</span>
              </div>
              <p className="text-sm mb-4">
                AI Trade Intelligence for Specialist Subcontractors
              </p>
              <p className="text-xs text-gray-500 italic">
                Built by people who've priced £500m+ of passive fire work.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#security" className="hover:text-white transition-colors">Security</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#about" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#customers" className="hover:text-white transition-colors">Customers</a></li>
                <li><a href="#contact" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#careers" className="hover:text-white transition-colors">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#help" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#docs" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#support" className="hover:text-white transition-colors">Support</a></li>
                <li><a href="#status" className="hover:text-white transition-colors">System Status</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} PassiveFire Verify+. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {showDemoModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Book a Live Demo</h3>
            <p className="text-gray-600 mb-6">
              See exactly how we catch scope gaps, normalize quotes, and protect your margins in a 15-minute walkthrough.
            </p>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Your name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="email"
                placeholder="Work email"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="tel"
                placeholder="Phone number"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Company name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold">
                Request Demo
              </button>
              <button
                onClick={() => setShowDemoModal(false)}
                className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-scroll {
          animation: scroll 30s linear infinite;
        }
      `}</style>
    </div>
  );
}
