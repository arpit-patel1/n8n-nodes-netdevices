# Juniper SSH "No Matching Key Exchange Algorithm" Fix

## Problem
Juniper devices (especially older JunOS versions) were failing to connect with the error:
```
no matching key exchange algorithm
```

## Root Cause
The SSH client (ssh2 library) and older Juniper devices didn't have compatible key exchange (KEX) algorithms. The original fallback configuration only included `diffie-hellman-group1-sha1`, which many Juniper devices don't support or have disabled.

## Solution
Added comprehensive legacy algorithm support with multiple fallback configurations:

### 1. **First Fallback** - Legacy Device Support
Targets older Juniper, Cisco, and similar devices:
- **KEX Algorithms**:
  - `diffie-hellman-group-exchange-sha256` ✅ Common on Juniper
  - `diffie-hellman-group-exchange-sha1` ✅ Common on Juniper
  - `diffie-hellman-group14-sha1` ✅ Standard legacy
  - `diffie-hellman-group1-sha1` (old fallback)

- **Host Key Algorithms**:
  - `ssh-rsa`
  - `ssh-dss` ✅ Often needed for very old devices

- **Ciphers**:
  - `aes128-cbc`, `aes256-cbc`
  - `3des-cbc` ✅ Legacy support
  - `aes192-cbc`

- **HMAC**:
  - `hmac-sha1`, `hmac-sha1-96`, `hmac-md5`

### 2. **Second Fallback** - Ultra-Legacy Support
For extremely old devices:
- **KEX**: `diffie-hellman-group1-sha1`, `diffie-hellman-group14-sha1`
- **Ciphers**: `3des-cbc`, `aes128-cbc`, `aes256-cbc`
- **HMAC**: `hmac-md5`, `hmac-sha1`
- **Host Keys**: `ssh-rsa`, `ssh-dss`

## Connection Process
The system now tries algorithms in this order:

1. **Modern algorithms** (secure, fast)
   - curve25519-sha256, ecdh-sha2-nistp256, etc.
   
2. **Legacy fallback** (older Juniper/Cisco)
   - diffie-hellman-group-exchange-sha256/sha1
   - Includes ssh-dss host keys
   
3. **Ultra-legacy fallback** (very old devices)
   - diffie-hellman-group1-sha1
   - 3des-cbc cipher support

## Juniper-Specific Notes

### Commonly Supported Algorithms on Juniper:
- **JunOS 12.x - 15.x**: Often requires `diffie-hellman-group-exchange-sha1`
- **JunOS 16.x+**: Supports modern algorithms but may have legacy enabled
- **Old SRX/EX**: May need `ssh-dss` host keys

### Testing Your Juniper Device
To see what algorithms your Juniper device supports, run:
```bash
ssh -vv user@juniper-device 2>&1 | grep "kex\|host key\|cipher\|mac"
```

### Manual Override (if needed)
If automatic fallback doesn't work, you can check device algorithms with:
```junos
show configuration system services ssh
```

## Files Modified
- `nodes/NetDevices/utils/base-connection.ts`
  - Updated `getOptimizedAlgorithms()` method
  - Added comprehensive documentation
  - Added two additional fallback configurations

## Compatibility
This fix maintains backward compatibility while adding support for:
- ✅ Older Juniper JunOS (12.x, 13.x, 14.x, 15.x)
- ✅ Older Cisco IOS
- ✅ Legacy network devices
- ✅ Modern devices (no impact - tried last)

## Security Note
⚠️ **Warning**: Legacy algorithms (especially `diffie-hellman-group1-sha1`, `3des-cbc`, `hmac-md5`) are cryptographically weak and should only be used with older devices that don't support modern algorithms. 

**Recommendation**: Update device firmware when possible to support modern cryptographic algorithms.

## Debugging
To enable detailed SSH debugging, set environment variable:
```bash
export SSH_DEBUG=true
```

This will log all SSH negotiation details to help diagnose connection issues.

## Testing
Build and test:
```bash
npm run lint
npm run build
```

## Related Issues
- Older Juniper devices requiring `diffie-hellman-group-exchange-sha1`
- Devices with `ssh-dss` host keys only
- Legacy cipher requirements (`3des-cbc`)

## Version
- Fixed in: v1.0.64 (pending)
- Issue: "no matching key exchange algorithm" with Juniper devices

