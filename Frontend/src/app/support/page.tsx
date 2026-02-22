'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Support Center
          </h1>
          <p className="text-xl text-gray-600">
            We're here to help you with your Stellara AI journey
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-3xl mb-4">📧</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Email Support
            </h3>
            <p className="text-gray-600 mb-4">
              Get help via email for detailed questions and technical issues.
            </p>
            <a 
              href="mailto:support@stellara.ai"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              support@stellara.ai
            </a>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-3xl mb-4">💬</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Live Chat
            </h3>
            <p className="text-gray-600 mb-4">
              Chat with our support team for immediate assistance.
            </p>
            <Button variant="outline" className="w-full">
              Start Chat
            </Button>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-3xl mb-4">📚</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Documentation
            </h3>
            <p className="text-gray-600 mb-4">
              Browse our comprehensive documentation and guides.
            </p>
            <Link href="/help">
              <Button variant="outline" className="w-full">
                View Docs
              </Button>
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-3xl mb-4">🐛</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Report a Bug
            </h3>
            <p className="text-gray-600 mb-4">
              Found an issue? Let us know on GitHub.
            </p>
            <a 
              href="https://github.com/stellara-network/Stellara_Contracts/issues"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" className="w-full">
                Report Issue
              </Button>
            </a>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-gray-600 mb-6">
            Find quick answers to common questions about Stellara AI.
          </p>
          <Link href="/help#faq">
            <Button variant="primary">View FAQ</Button>
          </Link>
        </div>

        <div className="mt-8 text-center">
          <Link href="/">
            <Button variant="ghost">← Back to Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
