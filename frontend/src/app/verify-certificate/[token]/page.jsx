'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { certificateService } from '@/modules/certificates/services/certificate.service';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Award,
  Calendar,
  User,
  BookOpen,
  Search,
  ShieldCheck,
  FileCheck,
  ArrowRight,
} from 'lucide-react';

export default function VerifyCertificatePage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token;

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    setLoading(true);

    certificateService
      .verifyPublicCertificate(token)
      .then((res) => {
        if (isMounted) {
          setResult(res.data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setResult({
            valid: false,
            status: 'not_found',
            message:
              err?.response?.data?.message ||
              'Unable to verify certificate. Please verify the link or enter the certificate number below.',
          });
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleManualSearch = (e) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    router.push(`/verify-certificate/${encodeURIComponent(searchInput.trim())}`);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Top Brand Bar */}
      <header className="bg-white border-b border-slate-200 py-4 px-6 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-md">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                LMS Certificate Verification
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Official Credential Registry
              </p>
            </div>
          </div>

          <form onSubmit={handleManualSearch} className="flex items-center space-x-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Verify ID or Token..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 sm:w-64"
              />
            </div>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors flex items-center space-x-1"
            >
              <span>Verify</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-10 flex flex-col justify-center">
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
            <h2 className="text-lg font-semibold text-slate-800">
              Verifying Certificate Authentic Seal...
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Checking cryptographic signatures against PostgreSQL registry.
            </p>
          </div>
        ) : result?.status === 'valid' ? (
          <div className="bg-white rounded-2xl border border-emerald-200 shadow-xl overflow-hidden">
            {/* Success Banner */}
            <div className="bg-emerald-600 text-white px-8 py-6 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm">
                  <ShieldCheck className="w-8 h-8 text-white" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold tracking-widest uppercase bg-emerald-700/60 px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                      Verified Authenticity
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold mt-1">Official Accredited Certificate</h2>
                  <p className="text-emerald-100 text-xs mt-0.5">
                    This certificate is genuine, securely registered, and currently active.
                  </p>
                </div>
              </div>
              <div className="hidden sm:block text-right">
                <div className="text-xs text-emerald-200 font-medium">Credential ID</div>
                <div className="text-sm font-mono font-bold tracking-wider">
                  {result.certificateNumber}
                </div>
              </div>
            </div>

            {/* Certificate Details Body */}
            <div className="p-8 space-y-6">
              <div className="text-center py-4 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                  {result.certificateType === 'course_completion'
                    ? 'Certificate of Completion'
                    : 'Certificate of Participation'}
                </span>
                <p className="text-sm text-slate-500 mt-1 font-serif italic">Proudly presented to</p>
                <h3 className="text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">
                  {result.studentName}
                </h3>
              </div>

              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200/80">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">
                  Awarded For
                </p>
                <div className="flex items-start space-x-3">
                  <BookOpen className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 leading-snug">
                      {result.subjectTitle}
                    </h4>
                    <p className="text-xs text-slate-600 mt-1">
                      {result.certificateType === 'course_completion'
                        ? 'Successfully fulfilled all academic curriculum requirements and comprehensive assessments.'
                        : 'Demonstrated verified active participation and attendance in live interactive session.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Grid Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center space-x-2 text-slate-500 text-xs font-medium mb-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Instructor / Host</span>
                  </div>
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {result.instructorName || 'Platform Faculty'}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center space-x-2 text-slate-500 text-xs font-medium mb-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Completion Date</span>
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    {formatDate(result.completionDate)}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center space-x-2 text-slate-500 text-xs font-medium mb-1">
                    <FileCheck className="w-3.5 h-3.5 text-slate-400" />
                    <span>Issued On</span>
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    {formatDate(result.issueDate)}
                  </div>
                </div>
              </div>

              {/* Footer Trust Statement */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span>Digital Cryptographic SHA-256 Signature Verified</span>
                </div>
                <span className="font-mono text-slate-400">{result.certificateNumber}</span>
              </div>
            </div>
          </div>
        ) : result?.status === 'revoked' ? (
          <div className="bg-white rounded-2xl border border-rose-200 shadow-xl overflow-hidden">
            <div className="bg-rose-600 text-white px-8 py-6 flex items-center space-x-4">
              <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm">
                <XCircle className="w-8 h-8 text-white" />
              </div>
              <div>
                <span className="text-xs font-bold tracking-widest uppercase bg-rose-700/60 px-2.5 py-0.5 rounded-full border border-rose-400/30">
                  Status: Revoked
                </span>
                <h2 className="text-2xl font-bold mt-1">Certificate Revoked</h2>
                <p className="text-rose-100 text-xs mt-0.5">
                  This credential is no longer valid and has been withdrawn by administrators.
                </p>
              </div>
            </div>

            <div className="p-8 space-y-6">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-5">
                <h4 className="text-sm font-bold text-rose-900 uppercase tracking-wider mb-1">
                  Reason for Revocation
                </h4>
                <p className="text-sm text-rose-800">
                  {result.revocationReason || 'Revoked per administrative review or reissuance.'}
                </p>
                <p className="text-xs text-rose-600 mt-2">
                  Revoked on: {formatDate(result.revokedAt)}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="text-xs text-slate-500">Originally Issued To</div>
                  <div className="font-semibold text-slate-800 mt-1">{result.studentName}</div>
                </div>
                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="text-xs text-slate-500">Course / Webinar</div>
                  <div className="font-semibold text-slate-800 mt-1">{result.subjectTitle}</div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 text-center">
                Credential ID: <span className="font-mono font-bold">{result.certificateNumber}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-amber-200 shadow-xl overflow-hidden">
            <div className="bg-amber-500 text-white px-8 py-6 flex items-center space-x-4">
              <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm">
                <AlertCircle className="w-8 h-8 text-white" />
              </div>
              <div>
                <span className="text-xs font-bold tracking-widest uppercase bg-amber-600/60 px-2.5 py-0.5 rounded-full border border-amber-300/30">
                  Not Found
                </span>
                <h2 className="text-2xl font-bold mt-1">Certificate Not Found</h2>
                <p className="text-amber-100 text-xs mt-0.5">
                  The verification token or certificate number is invalid.
                </p>
              </div>
            </div>

            <div className="p-8 text-center space-y-4">
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                No matching certificate record was found for this token or ID. Ensure you have entered the exact link or certificate number.
              </p>

              <form onSubmit={handleManualSearch} className="max-w-md mx-auto pt-4 flex gap-2">
                <input
                  type="text"
                  placeholder="Enter Certificate Number (e.g., LMS-2026-XXXX)..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="flex-1 px-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  Search
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} LMS Platform. Secure Credential Registry.</p>
      </footer>
    </div>
  );
}
