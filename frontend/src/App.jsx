import { useState } from 'react'
import { jsPDF } from 'jspdf'

function App() {
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copiedCategory, setCopiedCategory] = useState(null)

  const handleAnalyze = async () => {
    if (!text.trim() || text.length < 10) {
      setError('Please enter at least 10 characters of text')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch('http://127.0.0.1:8000/api/analyze/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Analysis failed')
      setResult(data)
    } catch (err) {
      setError(err.message || 'Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setText('')
    setResult(null)
    setError('')
  }

  const handleCopyCategory = (category, words) => {
    const copyText = Array.isArray(words) ? words.join(', ') : words
    navigator.clipboard.writeText(copyText)
    setCopiedCategory(category)
    setTimeout(() => setCopiedCategory(null), 2000)
  }

  const handleCopyStats = () => {
    const statsText = `Words: ${result.text_stats.word_count}
Sentences: ${result.text_stats.sentence_count}
Avg Words/Sentence: ${result.text_stats.avg_sentence_length}
Avg Word Length: ${result.text_stats.avg_word_length}
Characters: ${result.text_stats.character_count}`
    navigator.clipboard.writeText(statsText)
    setCopiedCategory('stats')
    setTimeout(() => setCopiedCategory(null), 2000)
  }

  const handleCopyReadability = () => {
    const readText = `Flesch-Kincaid Grade: ${result.readability.flesch_kincaid_grade}
Reading Level: ${result.readability.reading_level}
Description: ${result.readability.description}`
    navigator.clipboard.writeText(readText)
    setCopiedCategory('readability')
    setTimeout(() => setCopiedCategory(null), 2000)
  }

  const handleCopyPassive = () => {
    const passiveText = result.passive_sentences.length > 0
      ? result.passive_sentences.join('\n')
      : 'No passive voice sentences detected.'
    navigator.clipboard.writeText(passiveText)
    setCopiedCategory('passive')
    setTimeout(() => setCopiedCategory(null), 2000)
  }

  const handleCopyWordFreq = () => {
    const freqText = result.word_frequency.map(item => `${item.word}: ${item.count}`).join('\n')
    navigator.clipboard.writeText(freqText)
    setCopiedCategory('wordfreq')
    setTimeout(() => setCopiedCategory(null), 2000)
  }

  const handleDownloadPDF = () => {
    const doc = new jsPDF()
    let yPos = 20
    const lineHeight = 7
    const margin = 20
    const pageWidth = doc.internal.pageSize.getWidth()
    const maxWidth = pageWidth - margin * 2

    const addText = (text, fontSize = 12, isBold = false) => {
      doc.setFontSize(fontSize)
      doc.setFont('helvetica', isBold ? 'bold' : 'normal')
      const lines = doc.splitTextToSize(text, maxWidth)
      lines.forEach(line => {
        if (yPos > 270) {
          doc.addPage()
          yPos = 20
        }
        doc.text(line, margin, yPos)
        yPos += lineHeight
      })
    }

    const addSection = (title) => {
      if (yPos > 250) {
        doc.addPage()
        yPos = 20
      }
      yPos += 5
      addText(title, 14, true)
      yPos += 2
    }

    // Title
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('Text Analysis Report', margin, yPos)
    yPos += 15

    // Date
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos)
    yPos += 15

    // Input Text Section
    addSection('INPUT TEXT')
    addText(text, 11)

    // Text Statistics
    addSection('TEXT STATISTICS')
    addText(`Words: ${result.text_stats.word_count}`)
    addText(`Sentences: ${result.text_stats.sentence_count}`)
    addText(`Average Words per Sentence: ${result.text_stats.avg_sentence_length}`)
    addText(`Average Word Length: ${result.text_stats.avg_word_length}`)
    addText(`Characters: ${result.text_stats.character_count}`)

    // Readability Score
    addSection('READABILITY SCORE')
    addText(`Flesch-Kincaid Grade Level: ${result.readability.flesch_kincaid_grade}`)
    addText(`Reading Level: ${result.readability.reading_level}`)
    addText(`Description: ${result.readability.description}`)

    // Tense Analysis
    addSection('TENSE ANALYSIS')
    addText(`Past Tense: ${result.tense_analysis.past.length > 0 ? result.tense_analysis.past.join(', ') : 'None'}`)
    addText(`Present Tense: ${result.tense_analysis.present.length > 0 ? result.tense_analysis.present.join(', ') : 'None'}`)
    addText(`Future Tense: ${result.tense_analysis.future.length > 0 ? result.tense_analysis.future.join(', ') : 'None'}`)

    // Passive Voice
    addSection('PASSIVE VOICE DETECTION')
    if (result.passive_sentences.length > 0) {
      addText(`Found ${result.passive_sentences.length} sentence(s) with passive voice:`)
      result.passive_sentences.forEach((sentence, i) => {
        addText(`${i + 1}. ${sentence}`)
      })
    } else {
      addText('No passive voice sentences detected.')
    }

    // Word Frequency
    addSection('WORD FREQUENCY (TOP 10)')
    result.word_frequency.forEach((item, i) => {
      addText(`${i + 1}. ${item.word}: ${item.count}`)
    })

    // Parts of Speech
    addSection('PARTS OF SPEECH')
    if (result.parts_of_speech.nouns?.length > 0) {
      addText(`Nouns (${result.parts_of_speech.nouns.length}): ${result.parts_of_speech.nouns.join(', ')}`)
    }
    if (result.parts_of_speech.verbs?.length > 0) {
      addText(`Verbs (${result.parts_of_speech.verbs.length}): ${result.parts_of_speech.verbs.join(', ')}`)
    }
    if (result.parts_of_speech.adjectives?.length > 0) {
      addText(`Adjectives (${result.parts_of_speech.adjectives.length}): ${result.parts_of_speech.adjectives.join(', ')}`)
    }
    if (result.parts_of_speech.adverbs?.length > 0) {
      addText(`Adverbs (${result.parts_of_speech.adverbs.length}): ${result.parts_of_speech.adverbs.join(', ')}`)
    }
    if (result.parts_of_speech.pronouns?.length > 0) {
      addText(`Pronouns (${result.parts_of_speech.pronouns.length}): ${result.parts_of_speech.pronouns.join(', ')}`)
    }
    if (result.parts_of_speech.prepositions?.length > 0) {
      addText(`Prepositions (${result.parts_of_speech.prepositions.length}): ${result.parts_of_speech.prepositions.join(', ')}`)
    }
    if (result.parts_of_speech.conjunctions?.length > 0) {
      addText(`Conjunctions (${result.parts_of_speech.conjunctions.length}): ${result.parts_of_speech.conjunctions.join(', ')}`)
    }

    doc.save('text-analysis-report.pdf')
  }

  const CopyIcon = ({ category }) => (
    copiedCategory === category ? (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    )
  )

  const CopyButton = ({ category, onClick, color = 'gray' }) => (
    <button
      onClick={onClick}
      className={`p-1.5 rounded-md transition-colors ${
        copiedCategory === category
          ? `bg-${color}-200 text-${color}-700`
          : `hover:bg-${color}-100 text-${color}-500`
      }`}
      title="Copy to clipboard"
    >
      <CopyIcon category={category} />
    </button>
  )

  return (
    <div className="min-h-screen bg-sky-50">
      {/* Header */}
      <header className="bg-white border-b border-sky-100">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-800">Text Analyzer</h1>
              <p className="text-purple-600 text-sm">Comprehensive grammar and text analysis</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Input Section */}
        <div className="bg-white rounded-xl shadow-sm border border-sky-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <span className="w-2 h-2 bg-sky-500 rounded-full"></span>
              Input Text
            </label>
            <span className="text-xs text-sky-600 bg-sky-50 px-2 py-1 rounded-full">{text.length} chars</span>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your text here (minimum 10 characters)..."
            className="w-full h-48 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 focus:bg-white resize-none text-sm leading-relaxed transition-all"
          />

          <div className="flex items-center justify-end gap-4 mt-4">
            <button
              onClick={handleClear}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Clear
            </button>
            <button
              onClick={handleAnalyze}
              disabled={loading || text.length < 10}
              className="px-6 py-2.5 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Analyzing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Analyze
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 mb-6 flex items-center gap-3">
            <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-rose-600 text-sm">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Download PDF Button */}
            <div className="flex justify-end">
              <button
                onClick={handleDownloadPDF}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download PDF Report
              </button>
            </div>

            {/* Text Statistics */}
            <div className="bg-white rounded-xl shadow-sm border border-sky-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <h2 className="text-sm font-semibold text-gray-800">Text Statistics</h2>
                <button
                  onClick={handleCopyStats}
                  className={`ml-auto p-1.5 rounded-md transition-colors ${
                    copiedCategory === 'stats' ? 'bg-sky-200 text-sky-700' : 'hover:bg-sky-100 text-sky-500'
                  }`}
                  title="Copy statistics"
                >
                  <CopyIcon category="stats" />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-sky-50 rounded-lg p-4 border border-sky-100 text-center">
                  <div className="text-2xl font-bold text-sky-700">{result.text_stats.word_count}</div>
                  <div className="text-xs text-sky-600">Words</div>
                </div>
                <div className="bg-cyan-50 rounded-lg p-4 border border-cyan-100 text-center">
                  <div className="text-2xl font-bold text-cyan-700">{result.text_stats.sentence_count}</div>
                  <div className="text-xs text-cyan-600">Sentences</div>
                </div>
                <div className="bg-teal-50 rounded-lg p-4 border border-teal-100 text-center">
                  <div className="text-2xl font-bold text-teal-700">{result.text_stats.avg_sentence_length}</div>
                  <div className="text-xs text-teal-600">Avg Words/Sentence</div>
                </div>
                <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100 text-center">
                  <div className="text-2xl font-bold text-emerald-700">{result.text_stats.avg_word_length}</div>
                  <div className="text-xs text-emerald-600">Avg Word Length</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border border-green-100 text-center">
                  <div className="text-2xl font-bold text-green-700">{result.text_stats.character_count}</div>
                  <div className="text-xs text-green-600">Characters</div>
                </div>
              </div>
            </div>

            {/* Readability Score */}
            <div className="bg-white rounded-xl shadow-sm border border-sky-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <h2 className="text-sm font-semibold text-gray-800">Readability Score</h2>
                <button
                  onClick={handleCopyReadability}
                  className={`ml-auto p-1.5 rounded-md transition-colors ${
                    copiedCategory === 'readability' ? 'bg-indigo-200 text-indigo-700' : 'hover:bg-indigo-100 text-indigo-500'
                  }`}
                  title="Copy readability score"
                >
                  <CopyIcon category="readability" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
                  <div className="text-3xl font-bold text-indigo-700">{result.readability.flesch_kincaid_grade}</div>
                  <div className="text-xs text-indigo-600">Flesch-Kincaid Grade</div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium">
                      {result.readability.reading_level}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm">{result.readability.description}</p>
                </div>
              </div>
            </div>

            {/* Tense Analysis */}
            <div className="bg-white rounded-xl shadow-sm border border-sky-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-sm font-semibold text-gray-800">Tense Analysis</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Past Tense */}
                <div className="bg-rose-50 rounded-lg border border-rose-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-3 h-3 bg-rose-500 rounded-full"></span>
                    <span className="text-sm font-semibold text-rose-800">Past ({result.tense_analysis.past.length})</span>
                    {result.tense_analysis.past.length > 0 && (
                      <button
                        onClick={() => handleCopyCategory('past', result.tense_analysis.past)}
                        className={`ml-auto p-1.5 rounded-md transition-colors ${
                          copiedCategory === 'past' ? 'bg-rose-200 text-rose-700' : 'hover:bg-rose-100 text-rose-500'
                        }`}
                      >
                        <CopyIcon category="past" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.tense_analysis.past.length > 0 ? (
                      result.tense_analysis.past.map((word, i) => (
                        <span key={i} className="bg-rose-100 text-rose-700 px-2 py-1 rounded text-sm">{word}</span>
                      ))
                    ) : (
                      <span className="text-rose-400 text-sm">No past tense verbs</span>
                    )}
                  </div>
                </div>

                {/* Present Tense */}
                <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-3 h-3 bg-emerald-500 rounded-full"></span>
                    <span className="text-sm font-semibold text-emerald-800">Present ({result.tense_analysis.present.length})</span>
                    {result.tense_analysis.present.length > 0 && (
                      <button
                        onClick={() => handleCopyCategory('present', result.tense_analysis.present)}
                        className={`ml-auto p-1.5 rounded-md transition-colors ${
                          copiedCategory === 'present' ? 'bg-emerald-200 text-emerald-700' : 'hover:bg-emerald-100 text-emerald-500'
                        }`}
                      >
                        <CopyIcon category="present" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.tense_analysis.present.length > 0 ? (
                      result.tense_analysis.present.map((word, i) => (
                        <span key={i} className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-sm">{word}</span>
                      ))
                    ) : (
                      <span className="text-emerald-400 text-sm">No present tense verbs</span>
                    )}
                  </div>
                </div>

                {/* Future Tense */}
                <div className="bg-sky-50 rounded-lg border border-sky-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-3 h-3 bg-sky-500 rounded-full"></span>
                    <span className="text-sm font-semibold text-sky-800">Future ({result.tense_analysis.future.length})</span>
                    {result.tense_analysis.future.length > 0 && (
                      <button
                        onClick={() => handleCopyCategory('future', result.tense_analysis.future)}
                        className={`ml-auto p-1.5 rounded-md transition-colors ${
                          copiedCategory === 'future' ? 'bg-sky-200 text-sky-700' : 'hover:bg-sky-100 text-sky-500'
                        }`}
                      >
                        <CopyIcon category="future" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.tense_analysis.future.length > 0 ? (
                      result.tense_analysis.future.map((word, i) => (
                        <span key={i} className="bg-sky-100 text-sky-700 px-2 py-1 rounded text-sm">{word}</span>
                      ))
                    ) : (
                      <span className="text-sky-400 text-sm">No future tense verbs</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Passive Voice Detection */}
            <div className="bg-white rounded-xl shadow-sm border border-sky-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h2 className="text-sm font-semibold text-gray-800">Passive Voice Detection</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  result.passive_sentences.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                }`}>
                  {result.passive_sentences.length} found
                </span>
                <button
                  onClick={handleCopyPassive}
                  className={`ml-auto p-1.5 rounded-md transition-colors ${
                    copiedCategory === 'passive' ? 'bg-amber-200 text-amber-700' : 'hover:bg-amber-100 text-amber-500'
                  }`}
                  title="Copy passive sentences"
                >
                  <CopyIcon category="passive" />
                </button>
              </div>
              {result.passive_sentences.length > 0 ? (
                <div className="space-y-2">
                  {result.passive_sentences.map((sentence, i) => (
                    <div key={i} className="bg-amber-50 rounded-lg px-4 py-3 border border-amber-100 flex items-start gap-3">
                      <span className="bg-amber-200 text-amber-800 text-xs font-medium px-2 py-0.5 rounded">{i + 1}</span>
                      <p className="text-amber-800 text-sm">{sentence}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-green-50 rounded-lg px-4 py-3 border border-green-100 flex items-center gap-3">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-green-700 text-sm">No passive voice sentences detected. Great job using active voice!</p>
                </div>
              )}
            </div>

            {/* Word Frequency */}
            <div className="bg-white rounded-xl shadow-sm border border-sky-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-fuchsia-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
                <h2 className="text-sm font-semibold text-gray-800">Word Frequency (Top 10)</h2>
                <button
                  onClick={handleCopyWordFreq}
                  className={`ml-auto p-1.5 rounded-md transition-colors ${
                    copiedCategory === 'wordfreq' ? 'bg-fuchsia-200 text-fuchsia-700' : 'hover:bg-fuchsia-100 text-fuchsia-500'
                  }`}
                  title="Copy word frequency"
                >
                  <CopyIcon category="wordfreq" />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {result.word_frequency.map((item, i) => (
                  <div key={i} className="bg-fuchsia-50 rounded-lg p-3 border border-fuchsia-100 flex items-center justify-between">
                    <span className="text-fuchsia-800 text-sm font-medium">{item.word}</span>
                    <span className="bg-fuchsia-200 text-fuchsia-700 text-xs font-bold px-2 py-0.5 rounded-full">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Parts of Speech */}
            <div className="bg-white rounded-xl shadow-sm border border-sky-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                <h2 className="text-sm font-semibold text-gray-800">Parts of Speech</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nouns */}
                {result.parts_of_speech.nouns?.length > 0 && (
                  <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                      <span className="text-sm font-semibold text-blue-800">Nouns ({result.parts_of_speech.nouns.length})</span>
                      <button
                        onClick={() => handleCopyCategory('nouns', result.parts_of_speech.nouns)}
                        className={`ml-auto p-1.5 rounded-md transition-colors ${
                          copiedCategory === 'nouns' ? 'bg-blue-200 text-blue-700' : 'hover:bg-blue-100 text-blue-500'
                        }`}
                      >
                        <CopyIcon category="nouns" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {result.parts_of_speech.nouns.map((word, i) => (
                        <span key={i} className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm">{word}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Verbs */}
                {result.parts_of_speech.verbs?.length > 0 && (
                  <div className="bg-green-50 rounded-lg border border-green-200 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                      <span className="text-sm font-semibold text-green-800">Verbs ({result.parts_of_speech.verbs.length})</span>
                      <button
                        onClick={() => handleCopyCategory('verbs', result.parts_of_speech.verbs)}
                        className={`ml-auto p-1.5 rounded-md transition-colors ${
                          copiedCategory === 'verbs' ? 'bg-green-200 text-green-700' : 'hover:bg-green-100 text-green-500'
                        }`}
                      >
                        <CopyIcon category="verbs" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {result.parts_of_speech.verbs.map((word, i) => (
                        <span key={i} className="bg-green-100 text-green-700 px-2 py-1 rounded text-sm">{word}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Adjectives */}
                {result.parts_of_speech.adjectives?.length > 0 && (
                  <div className="bg-purple-50 rounded-lg border border-purple-200 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
                      <span className="text-sm font-semibold text-purple-800">Adjectives ({result.parts_of_speech.adjectives.length})</span>
                      <button
                        onClick={() => handleCopyCategory('adjectives', result.parts_of_speech.adjectives)}
                        className={`ml-auto p-1.5 rounded-md transition-colors ${
                          copiedCategory === 'adjectives' ? 'bg-purple-200 text-purple-700' : 'hover:bg-purple-100 text-purple-500'
                        }`}
                      >
                        <CopyIcon category="adjectives" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {result.parts_of_speech.adjectives.map((word, i) => (
                        <span key={i} className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-sm">{word}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Adverbs */}
                {result.parts_of_speech.adverbs?.length > 0 && (
                  <div className="bg-orange-50 rounded-lg border border-orange-200 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
                      <span className="text-sm font-semibold text-orange-800">Adverbs ({result.parts_of_speech.adverbs.length})</span>
                      <button
                        onClick={() => handleCopyCategory('adverbs', result.parts_of_speech.adverbs)}
                        className={`ml-auto p-1.5 rounded-md transition-colors ${
                          copiedCategory === 'adverbs' ? 'bg-orange-200 text-orange-700' : 'hover:bg-orange-100 text-orange-500'
                        }`}
                      >
                        <CopyIcon category="adverbs" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {result.parts_of_speech.adverbs.map((word, i) => (
                        <span key={i} className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-sm">{word}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pronouns */}
                {result.parts_of_speech.pronouns?.length > 0 && (
                  <div className="bg-pink-50 rounded-lg border border-pink-200 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-3 h-3 bg-pink-500 rounded-full"></span>
                      <span className="text-sm font-semibold text-pink-800">Pronouns ({result.parts_of_speech.pronouns.length})</span>
                      <button
                        onClick={() => handleCopyCategory('pronouns', result.parts_of_speech.pronouns)}
                        className={`ml-auto p-1.5 rounded-md transition-colors ${
                          copiedCategory === 'pronouns' ? 'bg-pink-200 text-pink-700' : 'hover:bg-pink-100 text-pink-500'
                        }`}
                      >
                        <CopyIcon category="pronouns" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {result.parts_of_speech.pronouns.map((word, i) => (
                        <span key={i} className="bg-pink-100 text-pink-700 px-2 py-1 rounded text-sm">{word}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prepositions */}
                {result.parts_of_speech.prepositions?.length > 0 && (
                  <div className="bg-cyan-50 rounded-lg border border-cyan-200 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-3 h-3 bg-cyan-500 rounded-full"></span>
                      <span className="text-sm font-semibold text-cyan-800">Prepositions ({result.parts_of_speech.prepositions.length})</span>
                      <button
                        onClick={() => handleCopyCategory('prepositions', result.parts_of_speech.prepositions)}
                        className={`ml-auto p-1.5 rounded-md transition-colors ${
                          copiedCategory === 'prepositions' ? 'bg-cyan-200 text-cyan-700' : 'hover:bg-cyan-100 text-cyan-500'
                        }`}
                      >
                        <CopyIcon category="prepositions" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {result.parts_of_speech.prepositions.map((word, i) => (
                        <span key={i} className="bg-cyan-100 text-cyan-700 px-2 py-1 rounded text-sm">{word}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conjunctions */}
                {result.parts_of_speech.conjunctions?.length > 0 && (
                  <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-3 h-3 bg-amber-500 rounded-full"></span>
                      <span className="text-sm font-semibold text-amber-800">Conjunctions ({result.parts_of_speech.conjunctions.length})</span>
                      <button
                        onClick={() => handleCopyCategory('conjunctions', result.parts_of_speech.conjunctions)}
                        className={`ml-auto p-1.5 rounded-md transition-colors ${
                          copiedCategory === 'conjunctions' ? 'bg-amber-200 text-amber-700' : 'hover:bg-amber-100 text-amber-500'
                        }`}
                      >
                        <CopyIcon category="conjunctions" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {result.parts_of_speech.conjunctions.map((word, i) => (
                        <span key={i} className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-sm">{word}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!result && !error && (
          <div className="bg-white rounded-xl border-2 border-dashed border-purple-200 p-12 text-center">
            <div className="w-14 h-14 mx-auto bg-purple-50 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-gray-600 font-medium">Text analysis will appear here</p>
            <p className="text-gray-400 text-sm mt-1">Paste text above and click Analyze</p>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
