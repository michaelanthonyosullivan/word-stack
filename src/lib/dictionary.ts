export interface TrieNode {
  children: { [char: string]: TrieNode };
  isWord?: boolean;
}

export class Trie {
  root: TrieNode = { children: {} };

  insert(word: string) {
    let node = this.root;
    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      if (!node.children[char]) node.children[char] = { children: {} };
      node = node.children[char];
    }
    node.isWord = true;
  }

  has(word: string): boolean {
    let node = this.root;
    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      if (!node.children[char]) return false;
      node = node.children[char];
    }
    return !!node.isWord;
  }
}

let dictionaryInstance: Trie | null = null;
let isLoaded = false;
let isLoading = false;
// commonWordSet is now the curated list used for all validation
let commonWordSet = new Set<string>();
// fullWordSet kept for AI and Trie-based prefix lookups
let fullWordSet = new Set<string>();
// Words the player has manually "challenged" into the common list this browser
let customWordSet = new Set<string>();
// Words the player has flagged as too obscure and removed from this browser's dictionary
let removedWordSet = new Set<string>();

const CUSTOM_WORDS_STORAGE_KEY = 'upwords_custom_words';
const REMOVED_WORDS_STORAGE_KEY = 'upwords_removed_words';

function loadCustomWordsFromStorage() {
  try {
    const raw = localStorage.getItem(CUSTOM_WORDS_STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as string[];
      customWordSet = new Set(arr.map(w => w.toUpperCase()));
    }
  } catch {
    customWordSet = new Set();
  }
}

function saveCustomWordsToStorage() {
  try {
    localStorage.setItem(CUSTOM_WORDS_STORAGE_KEY, JSON.stringify([...customWordSet]));
  } catch {
    // localStorage unavailable (e.g. private browsing) — custom words just won't persist
  }
}

function loadRemovedWordsFromStorage() {
  try {
    const raw = localStorage.getItem(REMOVED_WORDS_STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as string[];
      removedWordSet = new Set(arr.map(w => w.toUpperCase()));
    }
  } catch {
    removedWordSet = new Set();
  }
}

function saveRemovedWordsToStorage() {
  try {
    localStorage.setItem(REMOVED_WORDS_STORAGE_KEY, JSON.stringify([...removedWordSet]));
  } catch {
    // localStorage unavailable — removed words just won't persist
  }
}

export async function loadDictionary(onProgress?: (progress: number) => void): Promise<Trie> {
  if (dictionaryInstance && isLoaded) return dictionaryInstance;

  if (isLoading) {
    while (isLoading) await new Promise(r => setTimeout(r, 50));
    return dictionaryInstance!;
  }

  isLoading = true;
  loadCustomWordsFromStorage();
  loadRemovedWordsFromStorage();
  try {
    // Load common words (curated everyday English – no proper nouns) in parallel with full dict
    const [dictResponse, commonResponse] = await Promise.all([
      fetch('/dictionary.txt'),
      fetch('/common_words.txt')
    ]);

    if (!dictResponse.ok) throw new Error(`Dictionary load failed: ${dictResponse.status}`);
    if (!commonResponse.ok) throw new Error(`Common words load failed: ${commonResponse.status}`);

    // 1. Build common word set (used for game validation)
    const commonText = await commonResponse.text();
    const tempCommon = new Set<string>();
    for (const w of commonText.split('\n')) {
      const clean = w.trim().toUpperCase();
      if (clean.length >= 2 && clean.length <= 15) tempCommon.add(clean);
    }
    commonWordSet = tempCommon;

    // 2. Build full dictionary trie (used for AI move generation via prefix search)
    const text = await dictResponse.text();
    const words = text.split('\n');
    const trie = new Trie();
    const tempFull = new Set<string>();
    const total = words.length;
    let lastReport = 0;

    for (let i = 0; i < total; i++) {
      const word = words[i].trim().toUpperCase();
      if (word.length >= 2) {
        trie.insert(word);
        tempFull.add(word);
      }
      if (onProgress && i - lastReport > 15000) {
        onProgress(Math.round((i / total) * 100));
        lastReport = i;
        await new Promise(r => setTimeout(r, 0));
      }
    }

    dictionaryInstance = trie;
    fullWordSet = tempFull;
    isLoaded = true;
    if (onProgress) onProgress(100);
    console.log(`Dictionary loaded: ${fullWordSet.size} full / ${commonWordSet.size} common words.`);
    return trie;
  } catch (error) {
    console.error('Error loading dictionary:', error);
    const fallback = new Trie();
    const words = ['GAME','PLAY','WORD','BOARD','TILES','STACK',
                   'HELLO','WORLD','CAT','BAT','CAB','COAT','DOG','THE','AND','FOR',
                   'ARE','BUT','NOT','YOU','ALL','CAN','HER','WAS','ONE','OUR'];
    words.forEach(w => { fallback.insert(w); fullWordSet.add(w); commonWordSet.add(w); });
    dictionaryInstance = fallback;
    isLoaded = true;
    return fallback;
  } finally {
    isLoading = false;
  }
}

/** Validates a word for gameplay — uses the curated common-English set plus any challenged words */
export function isValidWord(word: string): boolean {
  const clean = word.trim().toUpperCase();
  if (removedWordSet.has(clean)) return false;
  if (customWordSet.has(clean)) return true;
  // Primary: check curated common dictionary
  if (commonWordSet.size > 0) return commonWordSet.has(clean);
  // Fallback: full dictionary if common set somehow not loaded
  return fullWordSet.has(clean);
}

export function isCommonWord(word: string): boolean {
  return commonWordSet.has(word.trim().toUpperCase());
}

/**
 * "Challenge" a rejected word into the common dictionary. Only succeeds if the
 * word is already in the full Scrabble-valid word list (fullWordSet) — this
 * lets a player fix real everyday words that were wrongly excluded by the
 * common-word curation (e.g. BICEP), without opening the door to adding
 * made-up words that aren't valid in any dictionary at all.
 */
export function challengeWord(word: string): boolean {
  const clean = word.trim().toUpperCase();
  if (removedWordSet.has(clean)) removedWordSet.delete(clean); // re-adding overrides an earlier removal
  if (!fullWordSet.has(clean)) return false;
  customWordSet.add(clean);
  commonWordSet.add(clean);
  saveCustomWordsToStorage();
  saveRemovedWordsToStorage();
  return true;
}

/**
 * The reverse direction — flag a word a bot played as too obscure and remove
 * it from this browser's dictionary going forward. Doesn't undo the bot's
 * already-scored play; it only prevents that word being played again.
 * Only works on words that are currently considered valid (no point
 * "removing" something that was never recognised in the first place).
 */
export function removeWordFromDictionary(word: string): boolean {
  const clean = word.trim().toUpperCase();
  if (!isValidWord(clean)) return false;
  removedWordSet.add(clean);
  customWordSet.delete(clean);
  saveRemovedWordsToStorage();
  saveCustomWordsToStorage();
  return true;
}

export function isWordRemoved(word: string): boolean {
  return removedWordSet.has(word.trim().toUpperCase());
}

export function getCustomWords(): string[] {
  return [...customWordSet].sort();
}

export function getRemovedWords(): string[] {
  return [...removedWordSet].sort();
}

export function getWordSet(): Set<string> { return fullWordSet; }
export function getCommonWordSet(): Set<string> { return commonWordSet; }
export function getTrieRoot(): TrieNode | null {
  return dictionaryInstance ? dictionaryInstance.root : null;
}
