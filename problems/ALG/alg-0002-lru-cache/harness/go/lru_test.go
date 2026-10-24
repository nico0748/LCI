package lru

import (
	"testing"
	"time"
)

func TestBasic(t *testing.T) {
	c := Constructor(2)
	c.Put(1, 1)
	c.Put(2, 2)
	if got := c.Get(1); got != 1 {
		t.Fatalf("Get(1) = %d, want 1", got)
	}
	c.Put(3, 3)
	if got := c.Get(2); got != -1 {
		t.Fatalf("Get(2) = %d, want -1", got)
	}
	c.Put(4, 4)
	if got := c.Get(1); got != -1 {
		t.Fatalf("Get(1) = %d, want -1", got)
	}
	if c.Get(3) != 3 || c.Get(4) != 4 {
		t.Fatalf("3 と 4 が残っているはず")
	}
}

func TestMissing(t *testing.T) {
	c := Constructor(1)
	if got := c.Get(42); got != -1 {
		t.Fatalf("Get(42) = %d, want -1", got)
	}
}

func TestGetRefreshes(t *testing.T) {
	c := Constructor(2)
	c.Put(1, 1)
	c.Put(2, 2)
	c.Get(1)
	c.Put(3, 3)
	if got := c.Get(1); got != 1 {
		t.Fatalf("get した 1 は追い出されないはず: Get(1) = %d", got)
	}
	if got := c.Get(2); got != -1 {
		t.Fatalf("Get(2) = %d, want -1", got)
	}
}

func TestUpdateDoesNotEvict(t *testing.T) {
	c := Constructor(2)
	c.Put(1, 1)
	c.Put(2, 2)
	c.Put(1, 10)
	if got := c.Get(1); got != 10 {
		t.Fatalf("Get(1) = %d, want 10", got)
	}
	if got := c.Get(2); got != 2 {
		t.Fatalf("既存キーの更新で 2 を追い出してはいけない: Get(2) = %d", got)
	}
}

func TestCapacityOne(t *testing.T) {
	c := Constructor(1)
	c.Put(1, 1)
	c.Put(2, 2)
	if c.Get(1) != -1 || c.Get(2) != 2 {
		t.Fatalf("容量 1 で 1 が追い出されていない")
	}
}

func TestLargeOps(t *testing.T) {
	c := Constructor(3000)
	t0 := time.Now()
	for i := 0; i < 100000; i++ {
		c.Put(i%10000, i)
		c.Get((i * 7) % 10000)
	}
	if time.Since(t0) > 2*time.Second {
		t.Fatalf("O(1) で動いていない可能性")
	}
	if got := c.Get(99999 % 10000); got != 99999 {
		t.Fatalf("Get = %d, want 99999", got)
	}
}
