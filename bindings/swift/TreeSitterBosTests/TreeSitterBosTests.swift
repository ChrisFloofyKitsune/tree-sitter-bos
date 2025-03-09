import XCTest
import SwiftTreeSitter
import TreeSitterBos

final class TreeSitterBosTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_bos())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading Bos Unit Animation Script grammar")
    }
}
