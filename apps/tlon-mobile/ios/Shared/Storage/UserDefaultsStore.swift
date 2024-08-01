//
//  UserDefaultsStore.swift
//  Landscape
//
//  Created by Alec Ananian on 10/3/23.
//

import Foundation

class UserDefaultsStore<T: Codable> {
    private var userDefaults: UserDefaults { .forDefaultAppGroup }

    private var storageKey: String
    private var fetchItem: ((String) async throws -> T)?
    private var fetchItems: (() async throws -> [String: T])?
    private var ttlSeconds: TimeInterval

    private var _lastFetchedAt: TimeInterval?
    private var lastFetchedAt: TimeInterval {
        get {
            if let cachedLastFetchedAt = _lastFetchedAt {
                return cachedLastFetchedAt
            }

            return userDefaults.double(forKey: "\(storageKey).lastFetchedAt")
        }

        set {
            _lastFetchedAt = newValue
            userDefaults.set(newValue, forKey: "\(storageKey).lastFetchedAt")
        }
    }

    private var _items: [String: T]?
    var items: [String: T] {
        get {
            if let cachedItems = _items {
                return cachedItems
            }

            if let data = userDefaults.object(forKey: storageKey) as? Data,
               let items = try? JSONDecoder().decode([String: T].self, from: data)
            {
                _items = items
                return items
            }

            return [:]
        }

        set {
            _items = newValue
            if let encoded = try? JSONEncoder().encode(newValue) {
                userDefaults.set(encoded, forKey: storageKey)
            }
        }
    }

    init(
        storageKey: String,
        fetchItem: ((String) async throws -> T)? = nil,
        fetchItems: (() async throws -> [String: T])? = nil,
        ttlSeconds: TimeInterval = 3600
    ) {
        self.storageKey = storageKey
        self.fetchItem = fetchItem
        self.fetchItems = fetchItems
        self.ttlSeconds = ttlSeconds
    }

    func getItem(_ key: String) -> T? {
        items[key]
    }

    func getOrFetchItem(_ key: String) async throws -> T? {
        // Only use the cached data if TTL is valid
        if Date.now.timeIntervalSince1970 - lastFetchedAt < ttlSeconds,
           let item = getItem(key)
        {
            return item
        }

        if let fetchItem {
            let item = try await fetchItem(key)
            items[key] = item
            lastFetchedAt = Date.now.timeIntervalSince1970
            return item
        }

        if let fetchItems {
            items = try await fetchItems()
            lastFetchedAt = Date.now.timeIntervalSince1970
        }

        return getItem(key)
    }
}
