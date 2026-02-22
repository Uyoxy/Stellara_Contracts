'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function NotFound() {
  const [searchQuery, setSearchQuery] = React.useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Redirect to search results page or implement search functionality
      window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`;
    }
  };

  const navigationLinks = [
    { href: '/academy', label: 'Academy', description: 'Learn Web3 and crypto concepts' },
    { href: '/feed', label: 'Feed', description: 'Stay updated with latest content' },
    { href: '/chat', label: 'Chat', description: 'Connect with the community' },
    { href: '/trade', label: 'Trade', description: 'Explore trading features' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full">
        {/* Main 404 Content */}
        <div className="text-center mb-12">
          {/* 404 Number with Animation */}
          <div className="relative mb-8">
            <div className="text-9xl font-bold text-blue-600 opacity-20 select-none">
              404
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-6xl font-bold text-gray-900 select-none">
                🚀
              </div>
            </div>
          </div>

          {/* Error Message */}
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Lost in Space?
          </h1>
          <p className="text-xl text-gray-600 mb-2 max-w-2xl mx-auto">
            The page you're looking for seems to have vanished into the crypto universe.
          </p>
          <p className="text-gray-500 max-w-lg mx-auto">
            Don't worry, even the best explorers get lost sometimes. Let us help you find your way back to Stellara AI.
          </p>
        </div>

        {/* Search Section */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Search for what you need
          </h2>
          <form onSubmit={handleSearch} className="flex gap-3">
            <Input
              type="text"
              placeholder="Search for courses, articles, or features..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" variant="primary" size="md">
              Search
            </Button>
          </form>
        </div>

        {/* Navigation Options */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            Explore Stellara AI
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {navigationLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all duration-200"
              >
                <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 mb-1">
                  {link.label}
                  <span className="inline-block ml-2 transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </h3>
                <p className="text-sm text-gray-600">
                  {link.description}
                </p>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/">
            <Button variant="primary" size="lg" className="w-full sm:w-auto">
              🏠 Go Home
            </Button>
          </Link>
          <Link href="/academy">
            <Button variant="outline" size="lg" className="w-full sm:w-auto">
              📚 Start Learning
            </Button>
          </Link>
          <Button 
            variant="ghost" 
            size="lg" 
            onClick={() => window.history.back()}
            className="w-full sm:w-auto"
          >
            ← Go Back
          </Button>
        </div>

        {/* Help Section */}
        <div className="mt-12 text-center">
          <p className="text-gray-500 mb-4">
            Still can't find what you're looking for?
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Link href="/support" className="text-blue-600 hover:text-blue-700 font-medium">
              Contact Support
            </Link>
            <span className="text-gray-300 hidden sm:inline">•</span>
            <Link href="/help" className="text-blue-600 hover:text-blue-700 font-medium">
              Help Center
            </Link>
            <span className="text-gray-300 hidden sm:inline">•</span>
            <a 
              href="https://github.com/stellara-network/Stellara_Contracts/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Report an Issue
            </a>
          </div>
        </div>

        {/* Brand Footer */}
        <div className="mt-16 pt-8 border-t border-gray-200 text-center">
          <div className="flex items-center justify-center mb-4">
            <span className="text-2xl font-bold text-blue-600">Stellara</span>
            <span className="text-2xl font-bold text-gray-900 ml-1">AI</span>
          </div>
          <p className="text-sm text-gray-500">
            The Intelligent Web3 Crypto Academy
          </p>
        </div>
      </div>
    </div>
  );
}
