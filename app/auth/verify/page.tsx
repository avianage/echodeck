export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-[#111111] flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h2 className="mt-6 text-3xl font-extrabold text-[#4a90e2]">Check your inbox</h2>
        <p className="mt-4 text-gray-300">
          We sent a sign in link to your email. It expires in 15 minutes.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Didn&apos;t get it? Check your spam folder or go back and try again.
        </p>
        <div className="mt-8">
          <a
            href="/auth/signin"
            className="text-[#4a90e2] hover:text-[#357abd] font-medium transition-colors"
          >
            ← Back to sign in
          </a>
        </div>
      </div>
    </div>
  );
}
