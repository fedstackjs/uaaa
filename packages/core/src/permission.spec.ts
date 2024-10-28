import { describe, it } from 'node:test'
import { expect } from 'expect'
import { Permission, rePermissionPath, rePermissionPathMatcher } from './permission.js'

describe('Permission Utils', () => {
  it('rePermissionPath should match valid permission paths', () => {
    // Invalid paths
    expect('/').not.toMatch(rePermissionPath)
    expect('/abc//def').not.toMatch(rePermissionPath)
    expect('/abc/def/').not.toMatch(rePermissionPath)
    expect('/$').not.toMatch(rePermissionPath)
    expect('/*abc*/def').not.toMatch(rePermissionPath)
    expect('/a*bc*/def').not.toMatch(rePermissionPath)
    expect('/**/def').not.toMatch(rePermissionPath)
    expect('/abc/def/**').not.toMatch(rePermissionPath)

    // Valid paths
    expect('/abc').toMatch(rePermissionPath)
    expect('/abc/def').toMatch(rePermissionPath)
    expect('/a-b_c/def_--').toMatch(rePermissionPath)
  })
  it('rePermissionPathMatcher should match valid permission path matchers', () => {
    // Invalid paths
    expect('/').not.toMatch(rePermissionPathMatcher)
    expect('/abc//def').not.toMatch(rePermissionPathMatcher)
    expect('/abc/def/').not.toMatch(rePermissionPathMatcher)
    expect('/$').not.toMatch(rePermissionPathMatcher)
    expect('/*abc*/def').not.toMatch(rePermissionPathMatcher)
    expect('/a*bc*/def').not.toMatch(rePermissionPathMatcher)
    expect('/**/def').not.toMatch(rePermissionPathMatcher)

    // Valid paths
    expect('/abc').toMatch(rePermissionPathMatcher)
    expect('/abc/def').toMatch(rePermissionPathMatcher)
    expect('/abc/def/**').toMatch(rePermissionPathMatcher)
    expect('/abc*/def').toMatch(rePermissionPathMatcher)
    expect('/*abc/def').toMatch(rePermissionPathMatcher)
    expect('/a*bc/def').toMatch(rePermissionPathMatcher)
    expect('/a*bc/de*f').toMatch(rePermissionPathMatcher)
  })
})

declare module './permission.js' {
  interface AppPermissionPaths {
    test: '/abc' | '/def'
  }
}

describe('Permission Class', () => {
  it('should match type', () => {
    const permission = Permission.fromScopedString('/ab*', 'test')
    expect(permission.test('/abc')).toBe(true)
    // @ts-expect-error
    expect(permission.test('/ghi')).toBe(false)
  })

  it('should throw error for invalid path', () => {
    expect(() => Permission.fromScopedString('/', 'test')).toThrowError()
    expect(() => Permission.fromScopedString('/', 'test')).toThrowError()
    expect(() => Permission.fromScopedString('/a*a*/', 'test')).toThrowError()
    expect(() => Permission.fromScopedString('/**/a', 'test')).toThrowError()
  })

  it('shoud match path', () => {
    const p1 = Permission.fromFullURL('uperm://test/a*c')
    expect(p1.test('/abc')).toBe(true)
    expect(p1.test('/aacc')).toBe(true)
    expect(p1.test('/ac')).toBe(true)
    expect(p1.test('/def')).toBe(false)
    expect(p1.test('/abc/def')).toBe(false)
    expect(p1.test('/a')).toBe(false)
    expect(p1.test('/ad')).toBe(false)
    const p2 = Permission.fromFullURL('uperm://test/abc/**', true)
    expect(p2.test('/abc')).toBe(false)
    expect(p2.test('/abc/def')).toBe(true)
    expect(p2.test('/abc/def/ghi')).toBe(true)
    expect(p2.test('/def')).toBe(false)
  })
})
