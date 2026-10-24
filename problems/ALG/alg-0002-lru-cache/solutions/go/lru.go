package lru

type node struct {
	key, value int
	prev, next *node
}

// LRUCache はハッシュマップ + 番兵付き双方向リスト。head.next が最新
type LRUCache struct {
	capacity int
	m        map[int]*node
	head     *node
}

func Constructor(capacity int) LRUCache {
	h := &node{}
	h.prev, h.next = h, h
	return LRUCache{capacity: capacity, m: make(map[int]*node, capacity+1), head: h}
}

func (c *LRUCache) unlink(n *node) {
	n.prev.next = n.next
	n.next.prev = n.prev
}

func (c *LRUCache) pushFront(n *node) {
	n.next = c.head.next
	n.prev = c.head
	c.head.next.prev = n
	c.head.next = n
}

func (c *LRUCache) Get(key int) int {
	n, ok := c.m[key]
	if !ok {
		return -1
	}
	c.unlink(n)
	c.pushFront(n)
	return n.value
}

func (c *LRUCache) Put(key, value int) {
	if n, ok := c.m[key]; ok {
		n.value = value
		c.unlink(n)
		c.pushFront(n)
		return
	}
	n := &node{key: key, value: value}
	c.m[key] = n
	c.pushFront(n)
	if len(c.m) > c.capacity {
		old := c.head.prev
		c.unlink(old)
		delete(c.m, old.key)
	}
}
