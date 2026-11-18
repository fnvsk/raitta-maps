import { describe, expect, it } from 'vitest';
import { matchCategory } from './categories';

describe('search by kind of place', () => {
  it('understands every language', () => {
    expect(matchCategory('азс')?.id).toBe('fuel');
    expect(matchCategory('Школа')?.id).toBe('school');
    expect(matchCategory('университет')?.id).toBe('university');
    expect(matchCategory('Päiväkoti')?.id).toBe('kindergarten');
    expect(matchCategory('paivakoti')?.id).toBe('kindergarten');
    expect(matchCategory('apotek')?.id).toBe('pharmacy');
    expect(matchCategory('kohvik')?.id).toBe('cafe');
    expect(matchCategory('gas station')?.id).toBe('fuel');
  });

  it('takes the start of a word, the shorter word first', () => {
    expect(matchCategory('аптек')?.id).toBe('pharmacy');
    expect(matchCategory('kahv')?.id).toBe('cafe');
    expect(matchCategory('park')?.id).toBe('park');
    expect(matchCategory('parkk')?.id).toBe('parking');
  });

  it('leaves names and addresses alone', () => {
    expect(matchCategory('Hämeenkatu 10')).toBeNull();
    expect(matchCategory('Näsinneula')).toBeNull();
    expect(matchCategory('ka')).toBeNull();
  });
});
