'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function HelpPage() {
  const faqs = [
    {
      question: "What is Stellara AI?",
      answer: "Stellara AI is an intelligent Web3 crypto academy that provides comprehensive learning resources, trading tools, and community features for cryptocurrency enthusiasts."
    },
    {
      question: "How do I get started with the Academy?",
      answer: "Simply navigate to the Academy section from the main menu. You'll find structured courses, tutorials, and learning materials suitable for all skill levels."
    },
    {
      question: "Is Stellara AI free to use?",
      answer: "Yes! Stellara AI offers free access to our basic learning materials and community features. Premium features may be available in the future."
    },
    {
      question: "How can I connect my wallet?",
      answer: "Click on the 'Sign Up' button in the header and follow the wallet connection prompts. We support various Web3 wallets including MetaMask and WalletConnect."
    },
    {
      question: "What blockchain networks are supported?",
      answer: "Currently, we primarily support Stellar and other major networks. Check our documentation for the most up-to-date list of supported networks."
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Help Center
          </h1>
          <p className="text-xl text-gray-600">
            Find answers to common questions and learn how to make the most of Stellara AI
          </p>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <div className="text-3xl mb-4">🚀</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Getting Started
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              New to Stellara? Start here.
            </p>
            <Link href="/academy">
              <Button variant="outline" size="sm">
                Start Learning
              </Button>
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <div className="text-3xl mb-4">📖</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Documentation
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              Detailed guides and API docs.
            </p>
            <Button variant="outline" size="sm">
              View Docs
            </Button>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <div className="text-3xl mb-4">💬</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Community
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              Connect with other users.
            </p>
            <Link href="/chat">
              <Button variant="outline" size="sm">
                Join Chat
              </Button>
            </Link>
          </div>
        </div>

        {/* FAQ Section */}
        <div id="faq" className="bg-white rounded-lg shadow-sm p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <div key={index} className="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {faq.question}
                </h3>
                <p className="text-gray-600">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Additional Help */}
        <div className="bg-blue-50 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Still need help?
          </h2>
          <p className="text-gray-600 mb-6">
            Our support team is here to assist you with any questions or issues.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/support">
              <Button variant="primary">
                Contact Support
              </Button>
            </Link>
            <a 
              href="https://github.com/stellara-network/Stellara_Contracts/issues"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline">
                Report an Issue
              </Button>
            </a>
          </div>
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
