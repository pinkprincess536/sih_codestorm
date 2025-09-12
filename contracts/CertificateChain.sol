// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract CertificateChain {
    struct Certificate {
        string candidateHash;
        uint timestamp;
        address issuer;
    }

    mapping(string => Certificate) public certificates;
    string[] private allHashesList; // ✅ keep track of all hashes

    event CertificateAdded(string candidateHash, address issuer);

    // Single insert
    function addCertificate(string memory _candidateHash) public {
        require(bytes(certificates[_candidateHash].candidateHash).length == 0, "Already exists!");
        certificates[_candidateHash] = Certificate(_candidateHash, block.timestamp, msg.sender);
        allHashesList.push(_candidateHash); // ✅ save key
        emit CertificateAdded(_candidateHash, msg.sender);
    }

    // ✅ Batch insert
    function addBatch(string[] memory _candidateHashes) public {
        for (uint i = 0; i < _candidateHashes.length; i++) {
            string memory hash = _candidateHashes[i];
            if (bytes(certificates[hash].candidateHash).length == 0) {
                certificates[hash] = Certificate(hash, block.timestamp, msg.sender);
                allHashesList.push(hash); // ✅ save key
                emit CertificateAdded(hash, msg.sender);
            }
        }
    }

    // Verify certificate
    function verifyCertificate(string memory _candidateHash) public view returns (bool, uint, address) {
        if (bytes(certificates[_candidateHash].candidateHash).length == 0) {
            return (false, 0, address(0));
        }
        Certificate memory cert = certificates[_candidateHash];
        return (true, cert.timestamp, cert.issuer);
    }

    // ✅ Return all candidate hashes
    function allHashes() public view returns (string[] memory) {
        return allHashesList;
    }
}
