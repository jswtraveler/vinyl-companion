/**
 * AddAlbumPage Component
 *
 * Three methods for adding albums to collection:
 * 1. Find by Name (Primary) - Search database
 * 2. Identify from Image - Camera/upload
 * 3. Manual Entry - Full form
 */
const AddAlbumPage = ({ onFindByName, onIdentifyImage, onManualEntry }) => {
  return (
    <div className="pb-20">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Add to Collection</h2>
        <p className="text-gray-400 text-sm">
          Choose how to add your album
        </p>
      </div>

      {/* Add Method Cards */}
      <div className="space-y-4">
        {/* Find by Name - Primary Method */}
        <button
          onClick={onFindByName}
          className="w-full bg-gradient-to-br from-purple-900/40 to-gray-800 border-2 border-purple-500 rounded-xl p-6 hover:from-purple-900/60 hover:to-gray-700 transition-all duration-200 text-left group"
        >
          <div className="flex items-start gap-4">
            <div className="text-5xl flex-shrink-0">🔍</div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-purple-300 transition-colors">
                Find by Name
              </h3>
              <div className="h-px bg-gray-700 my-3"></div>
              <p className="text-gray-400 text-sm mb-4">
                Search our database by artist or album name. Most accurate and fastest method.
              </p>
              <div className="flex items-center text-purple-400 text-sm font-medium">
                <span>Search Now</span>
                <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        </button>

        {/* Identify from Image */}
        <button
          onClick={onIdentifyImage}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl p-6 hover:bg-gray-750 hover:border-gray-600 transition-all duration-200 text-left group"
        >
          <div className="flex items-start gap-4">
            <div className="text-5xl flex-shrink-0">📷</div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-gray-300 transition-colors">
                Identify from Image
              </h3>
              <div className="h-px bg-gray-700 my-3"></div>
              <p className="text-gray-400 text-sm mb-4">
                Take a photo of the album cover or upload an image to automatically identify the album.
              </p>
              <div className="flex items-center text-gray-400 text-sm font-medium">
                <span>Take Photo or Upload</span>
                <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        </button>

        {/* Manual Entry */}
        <button
          onClick={onManualEntry}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl p-6 hover:bg-gray-750 hover:border-gray-600 transition-all duration-200 text-left group"
        >
          <div className="flex items-start gap-4">
            <div className="text-5xl flex-shrink-0">✏️</div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-gray-300 transition-colors">
                Manual Entry
              </h3>
              <div className="h-px bg-gray-700 my-3"></div>
              <p className="text-gray-400 text-sm mb-4">
                Enter album details manually if you can't find it in our database.
              </p>
              <div className="flex items-center text-gray-400 text-sm font-medium">
                <span>Enter Details</span>
                <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Help Text */}
      <div className="mt-8 bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h4 className="text-sm font-semibold text-white mb-1">Tips</h4>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>• <strong className="text-gray-300">Find by Name</strong> is the quickest and most accurate method</li>
              <li>• <strong className="text-gray-300">Image Identification</strong> works best with clear, well-lit photos</li>
              <li>• <strong className="text-gray-300">Manual Entry</strong> gives you full control over all details</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddAlbumPage;
