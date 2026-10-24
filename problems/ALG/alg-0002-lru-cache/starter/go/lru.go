package lru

type LRUCache struct {
	capacity int
}

func Constructor(capacity int) LRUCache {
	return LRUCache{capacity: capacity}
}

func (c *LRUCache) Get(key int) int {
	return -1
}

func (c *LRUCache) Put(key, value int) {}
