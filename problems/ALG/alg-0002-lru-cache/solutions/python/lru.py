class _Node:
    __slots__ = ("key", "value", "prev", "next")

    def __init__(self, key: int = 0, value: int = 0) -> None:
        self.key = key
        self.value = value
        self.prev: "_Node" = self
        self.next: "_Node" = self


class LRUCache:
    """ハッシュマップ + 番兵付き双方向リスト。先頭（head.next）が最新"""

    def __init__(self, capacity: int) -> None:
        self.capacity = capacity
        self.map: dict[int, _Node] = {}
        self.head = _Node()

    def _unlink(self, n: _Node) -> None:
        n.prev.next = n.next
        n.next.prev = n.prev

    def _push_front(self, n: _Node) -> None:
        n.next = self.head.next
        n.prev = self.head
        self.head.next.prev = n
        self.head.next = n

    def get(self, key: int) -> int:
        n = self.map.get(key)
        if n is None:
            return -1
        self._unlink(n)
        self._push_front(n)
        return n.value

    def put(self, key: int, value: int) -> None:
        n = self.map.get(key)
        if n is not None:
            n.value = value
            self._unlink(n)
            self._push_front(n)
            return
        n = _Node(key, value)
        self.map[key] = n
        self._push_front(n)
        if len(self.map) > self.capacity:
            old = self.head.prev
            self._unlink(old)
            del self.map[old.key]
