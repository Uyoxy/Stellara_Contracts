'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Search Results
          </h1>
          <p className="text-gray-600">
            Searching for: <span className="font-semibold">"{query}"</span>
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <div className="mb-6">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Search Coming Soon
            </h2>
            <p className="text-gray-600 mb-6">
              Our search functionality is currently under development. 
              In the meantime, you can explore our main sections below.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <Link href="/academy">
              <div className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all">
                <h3 className="font-semibold text-gray-900 mb-1">📚 Academy</h3>
                <p className="text-sm text-gray-600">Browse our learning materials</p>
              </div>
            </Link>
            <Link href="/feed">
              <div className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all">
                <h3 className="font-semibold text-gray-900 mb-1">📰 Feed</h3>
                <p className="text-sm text-gray-600">Check out the latest updates</p>
              </div>
            </Link>
            <Link href="/chat">
              <div className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all">
                <h3 className="font-semibold text-gray-900 mb-1">💬 Chat</h3>
                <p className="text-sm text-gray-600">Connect with the community</p>
              </div>
            </Link>
            <Link href="/trade">
              <div className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all">
                <h3 className="font-semibold text-gray-900 mb-1">💱 Trade</h3>
                <p className="text-sm text-gray-600">Explore trading features</p>
              </div>
            </Link>
          </div>

          <div className="flex justify-center">
            <Link href="/">
              <Button variant="primary">Return Home</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
