'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/components/Logo';
import Navbar from '@/components/Navbar';
import { CheckCircleIcon } from '@/components/Icons';
import { api } from '@/lib/api';

type Tab = 'waitlist' | 'expansion';

export default function WaitlistPage() {
  const [activeTab, setActiveTab] = useState<Tab>('waitlist');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  
  // Expansion tab state
  const [expansionEmail, setExpansionEmail] = useState('');
  const [expansionName, setExpansionName] = useState('');
  const [cities, setCities] = useState<string[]>(['']);
  const [expansionLoading, setExpansionLoading] = useState(false);
  const [expansionSuccess, setExpansionSuccess] = useState(false);
  const [expansionError, setExpansionError] = useState('');
  
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.addToWaitlist({
        email,
        name: name || undefined,
        city: city || undefined,
        message: message || undefined,
      });
      setSuccess(true);
      // Reset form
      setEmail('');
      setName('');
      setCity('');
      setMessage('');
    } catch (err: any) {
      setError(err.message || 'Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCityChange = (index: number, value: string) => {
    const newCities = [...cities];
    newCities[index] = value;
    setCities(newCities);
  };

  const addCityField = () => {
    setCities([...cities, '']);
  };

  const removeCityField = (index: number) => {
    if (cities.length > 1) {
      const newCities = cities.filter((_, i) => i !== index);
      setCities(newCities);
    }
  };

  const handleExpansionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpansionError('');
    setExpansionLoading(true);

    try {
      const citiesList = cities.filter(c => c.trim() !== '').join(', ');
      await api.addToWaitlist({
        email: expansionEmail,
        name: expansionName || undefined,
        city: citiesList || undefined,
        message: `Expansion request for: ${citiesList}`,
      });
      setExpansionSuccess(true);
      // Reset form
      setExpansionEmail('');
      setExpansionName('');
      setCities(['']);
    } catch (err: any) {
      setExpansionError(err.message || 'Failed to submit. Please try again.');
    } finally {
      setExpansionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Logo size="large" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Join the Waitlist
            </h1>
            <p className="text-gray-600 text-lg">
              We&apos;re currently in beta and live in the Washington, D.C. metro area. 
              Let us know where you&apos;d like to see Dots next!
            </p>
          </div>

          {/* Tabs */}
          <div className="flex items-center justify-center space-x-4 mb-8 border-b border-gray-200">
            <button
              onClick={() => {
                setActiveTab('waitlist');
                setSuccess(false);
                setExpansionSuccess(false);
              }}
              className={`px-6 py-3 font-semibold transition-all duration-300 border-b-2 ${
                activeTab === 'waitlist'
                  ? 'border-[#0ef9b4] text-[#0ef9b4]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Waitlist
            </button>
            <button
              onClick={() => {
                setActiveTab('expansion');
                setSuccess(false);
                setExpansionSuccess(false);
              }}
              className={`px-6 py-3 font-semibold transition-all duration-300 border-b-2 ${
                activeTab === 'expansion'
                  ? 'border-[#0ef9b4] text-[#0ef9b4]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Expansion
            </button>
          </div>

          {/* Waitlist Tab */}
          {activeTab === 'waitlist' && (
            <>
              {success ? (
            <div className="text-center py-8">
              <CheckCircleIcon className="w-16 h-16 mx-auto mb-4 text-green-500" aria-hidden />
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Thanks for joining!</h2>
              <p className="text-gray-600 mb-6">
                We&apos;ll keep you updated on when Dots launches in your area.
              </p>
              <button
                onClick={() => {
                  setSuccess(false);
                  router.push('/');
                }}
                className="bg-[#0ef9b4] text-black px-6 py-3 rounded-lg font-semibold hover:bg-[#0dd9a0] transition-colors"
              >
                Back to Home
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ef9b4] focus:border-transparent"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Name (Optional)
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ef9b4] focus:border-transparent"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
                  City (Optional)
                </label>
                <input
                  id="city"
                  name="city"
                  type="text"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ef9b4] focus:border-transparent"
                  placeholder="Where would you like to see Dots?"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                  Feedback or Message (Optional)
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ef9b4] focus:border-transparent resize-none"
                  placeholder="Share your thoughts, suggestions, or let us know what you'd like to see in Dots..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0ef9b4] text-black px-6 py-4 rounded-lg font-bold hover:bg-[#0dd9a0] transition-colors disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Join Waitlist'}
              </button>
            </form>
          )}
            </>
          )}

          {/* Expansion Tab */}
          {activeTab === 'expansion' && (
            <div className="space-y-8">
              {expansionSuccess ? (
                <div className="text-center py-8">
                  <CheckCircleIcon className="w-16 h-16 mx-auto mb-4 text-green-500" aria-hidden />
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Thanks for your suggestions!</h2>
                  <p className="text-gray-600 mb-6">
                    We&apos;ll keep you updated on when Dots launches in your suggested cities.
                  </p>
                  <button
                    onClick={() => {
                      setExpansionSuccess(false);
                      router.push('/');
                    }}
                    className="bg-[#0ef9b4] text-black px-6 py-3 rounded-lg font-semibold hover:bg-[#0dd9a0] transition-colors"
                  >
                    Back to Home
                  </button>
                </div>
              ) : (
                <>
                  {/* Where to next? Section */}
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Where to next?</h2>
                    <p className="text-gray-600 mb-6">
                      Where should we go next? Add your suggestions and join the waitlist as we expand into new locations.
                    </p>
                    
                    <form onSubmit={handleExpansionSubmit} className="space-y-6">
                      {expansionError && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                          {expansionError}
                        </div>
                      )}

                      <div>
                        <label htmlFor="expansion-email" className="block text-sm font-medium text-gray-700 mb-2">
                          Email Address <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="expansion-email"
                          name="expansion-email"
                          type="email"
                          required
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ef9b4] focus:border-transparent"
                          placeholder="your@email.com"
                          value={expansionEmail}
                          onChange={(e) => setExpansionEmail(e.target.value)}
                        />
                      </div>

                      <div>
                        <label htmlFor="expansion-name" className="block text-sm font-medium text-gray-700 mb-2">
                          Name (Optional)
                        </label>
                        <input
                          id="expansion-name"
                          name="expansion-name"
                          type="text"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ef9b4] focus:border-transparent"
                          placeholder="Your name"
                          value={expansionName}
                          onChange={(e) => setExpansionName(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Cities <span className="text-red-500">*</span>
                        </label>
                        <div className="space-y-3">
                          {cities.map((city, index) => (
                            <div key={index} className="flex gap-2">
                              <input
                                type="text"
                                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ef9b4] focus:border-transparent"
                                placeholder={`City ${index + 1} (e.g., New York, NY)`}
                                value={city}
                                onChange={(e) => handleCityChange(index, e.target.value)}
                                required={index === 0}
                              />
                              {cities.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeCityField(index)}
                                  className="px-4 py-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                                  aria-label="Remove city"
                                >
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={addCityField}
                          className="mt-2 text-sm text-[#0ef9b4] hover:text-[#0dd9a0] font-medium flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Add another city
                        </button>
                      </div>

                      <button
                        type="submit"
                        disabled={expansionLoading}
                        className="w-full bg-[#0ef9b4] text-black px-6 py-4 rounded-lg font-bold hover:bg-[#0dd9a0] transition-colors disabled:opacity-50"
                      >
                        {expansionLoading ? 'Submitting...' : 'Submit Suggestions'}
                      </button>
                    </form>
                  </div>

                  {/* Partnerships Section */}
                  <div className="pt-8 border-t border-gray-200">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Partnerships</h2>
                    <p className="text-gray-600 mb-4">
                      We love collaborations! Contact us to explore partnerships, pilots, and new community launches.
                    </p>
                    <a
                      href="mailto:contact@dotsmove.com"
                      className="inline-flex items-center gap-2 text-[#0ef9b4] hover:text-[#0dd9a0] font-semibold transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      contact@dotsmove.com
                    </a>
                  </div>

                  {/* Instagram Section */}
                  <div className="pt-8 border-t border-gray-200">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Follow Us</h2>
                    <p className="text-gray-600 mb-4">
                      Follow us on Instagram for more updates!
                    </p>
                    <a
                      href="https://instagram.com/dotsmove"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-[#0ef9b4] hover:text-[#0dd9a0] font-semibold transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                      @dotsmove
                    </a>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="mt-8 pt-8 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link href="/login" className="text-[#0ef9b4] hover:text-[#0dd9a0] font-semibold">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
